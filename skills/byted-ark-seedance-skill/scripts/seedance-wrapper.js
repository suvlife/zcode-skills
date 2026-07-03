#!/usr/bin/env node

/**
 * byted-ark-seedance-skill - 豆包视频生成 Skill v2
 *
 * Seedance Skill Wrapper - Agent 原生状态管理
 * 
 * 在纯 CLI 的基础上增加了：
 * 1. 待办任务列表自动管理（.pending-tasks.json）
 * 2. 批量检查待完成任务的命令
 * 3. 格式化的友好输出
 * 
 * 设计原则：零依赖、纯 JS、用完即走、状态透明
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PENDING_FILE = path.join(__dirname, '..', '.pending-tasks.json');
const CLI_SCRIPT = path.join(__dirname, 'seedance.js');

// 从 args 数组中移除指定参数及其值（安全支持无值布尔参数）
function removeArgPair(args, argName) {
  const index = args.indexOf(argName);
  if (index !== -1) {
    const next = args[index + 1];
    // 只有当后面的 token 不是 -- 开头的参数时，才一起移除
    // 这样 --draft --service-tier flex 只会删掉 --draft，不会误删 --service-tier
    const deleteCount = next && !next.startsWith('--') ? 2 : 1;
    args.splice(index, deleteCount);
  }
  return args;
}

// 展开 ~ 开头的路径
function expandHome(p) {
  const os = require('os');
  const home = os.homedir();
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p;
}

// 🛡️ 下载目录三级 fallback：优先环境变量 ARK_SEEDANCE_SAVE_PATH → 其次桌面（仅当目录已存在）→ 其次 home 目录 → 最后当前目录
// 适配无头服务器、Docker 等没有桌面目录的环境，不会强行创建不存在的 Desktop 目录
function getDefaultDownloadDir() {
  const os = require('os');
  const fs = require('fs');
  const home = os.homedir();
  const desktop = path.join(home, 'Desktop');
  
  const paths = [
    // 🐛 Bug 修复：支持 ARK_SEEDANCE_SAVE_PATH 环境变量
    process.env.ARK_SEEDANCE_SAVE_PATH ? path.resolve(expandHome(process.env.ARK_SEEDANCE_SAVE_PATH)) : null,
    fs.existsSync(desktop) ? path.join(desktop, 'Seedance-Videos') : null,  // Desktop 存在才用
    path.join(home, 'Seedance-Videos'),                                      // 其次 home 目录
    path.join(process.cwd(), 'Seedance-Videos'),                             // 最后当前工作目录
  ].filter(Boolean);  // 过滤掉 null
  
  // 找第一个可写入的路径（不存在会自动创建）
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
      fs.accessSync(p, fs.constants.W_OK);
      return p;
    } catch (e) {
      continue;  // 这个路径不行，试下一个
    }
  }
  return paths[paths.length - 1];  // 实在不行就用当前目录
}

const DEFAULT_DOWNLOAD_DIR = getDefaultDownloadDir();

// Wrapper 只做参数兼容，不处理 API Key 鉴权
// 完整的鉴权逻辑在 seedance.js 的 resolveApiKey() 中实现

// 🛡️ 参数格式兼容：自动把 --key=value 拆分成 --key value
function expandEqualsArgs(args) {
  const result = [];
  for (const arg of args) {
    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, ...rest] = arg.split('=');
      result.push(key, rest.join('='));
    } else {
      result.push(arg);
    }
  }
  return result;
}

// 🛡️ 参数命名兼容层：自动把下划线参数转成中划线，防止大模型记错
function normalizeArgs(args) {
  // 兼容 --key=value 格式，所有 handler 自动生效
  args = expandEqualsArgs(args);
  
  const argMap = {
    '--generate_audio': '--generate-audio',
    '--service_tier': '--service-tier',
    '--enable_web_search': '--enable-web-search',
    '--reference_images': '--image-file',
    '--reference_video': '--video-file',
    '--reference_audio': '--audio-file',
    '--api_key': '--api-key',
    '--user_id': '--user-id',
    '--task_id': '--task-id',
    '--return_last_frame': '--return-last-frame',
    '--camera_fixed': '--camera-fixed',
    '--callback_url': '--callback-url',
    '--payload_file': '--payload-file',
    '--base_url': '--base-url',
    '--save_api_key': '--save-api-key',
  };
  return args.map(arg => argMap[arg] || arg);
}

// 🛡️ 安全 JSON 解析：从「JSON + 下载日志」混合输出中智能提取有效 JSON
function safeJSONParse(stdoutStr) {
  try {
    return JSON.parse(stdoutStr);
  } catch (e) {
    // 遇到含有额外下载日志的 stdout，智能截取第一个 { 到最后一个 }
    const firstBrace = stdoutStr.indexOf('{');
    const lastBrace = stdoutStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(stdoutStr.substring(firstBrace, lastBrace + 1));
      } catch (err) {
        throw new Error('截取后依然无法解析 JSON');
      }
    }
    throw e;
  }
}

// 确保待办文件存在
function ensurePendingFile() {
  if (!fs.existsSync(PENDING_FILE)) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

// 读取待办列表
function getPendingTasks() {
  ensurePendingFile();
  return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
}

// 写入待办列表（原子写：临时文件 + rename，避免文件损坏
function savePendingTasks(tasks) {
  const tmpFile = `${PENDING_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2), 'utf8');
  fs.renameSync(tmpFile, PENDING_FILE);
}

// 添加任务到待办列表
function addPendingTask(taskId, prompt, model) {
  const tasks = getPendingTasks();
  tasks.push({
    task_id: taskId,
    prompt: prompt,
    model: model,
    created_at: Date.now(),
  });
  savePendingTasks(tasks);
  console.log(`✅ 任务 ${taskId} 已加入待办列表`);
}

// 从待办列表移除任务
function removePendingTask(taskId) {
  const tasks = getPendingTasks();
  const newTasks = tasks.filter(t => t.task_id !== taskId);
  if (newTasks.length !== tasks.length) {
    savePendingTasks(newTasks);
    console.log(`✅ 任务 ${taskId} 已从待办列表移除`);
  }
}

// 执行底层 CLI
function execCLI(args, { silent = false } = {}) {
  const result = spawnSync('node', [CLI_SCRIPT, ...args], {
    encoding: 'utf8',
    env: process.env,
  });
  
  if (!silent) {
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
  
  return result;
}

// 解析 create 命令输出的 task_id
function parseTaskIdFromOutput(output) {
  const match = output.match(/"id":\s*"(cgt-[^"]+)"/);
  if (match) return match[1];
  
  const match2 = output.match(/Created task:\s*(cgt-\S+)/);
  if (match2) return match2[1];
  
  return null;
}

// 格式化单个任务状态
function formatTaskStatus(taskDetail, pendingInfo, downloadDir) {
  const statusMap = {
    'queued': '排队中 🕒',
    'running': '生成中 ⚙️',
    'succeeded': '成功 ✅',
    'failed': '失败 ❌',
    'cancelled': '已取消 🚫',
    'expired': '已过期 ⏰',
  };
  
  const status = taskDetail.status || 'unknown';
  const statusText = statusMap[status] || status;
  const prompt = pendingInfo?.prompt || taskDetail.request?.content?.[0]?.text || '(无提示词)';
  const elapsed = pendingInfo ? Math.floor((Date.now() - pendingInfo.created_at) / 1000 / 60) : null;
  
  const lines = [
    `🎬 任务 ID: ${taskDetail.id}`,
    `📊 状态: ${statusText}`,
    `💡 提示词: ${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}`,
    `🤖 模型: ${pendingInfo?.model || taskDetail.model || 'unknown'}`,
  ];
  
  if (elapsed !== null) {
    lines.push(`⏱️ 已耗时: ${elapsed} 分钟`);
  }
  
  // 【修复点】：API 返回的是 content 字段
  if (status === 'succeeded' && taskDetail.content) {
    const duration = taskDetail.duration; 
    
    if (duration) lines.push(`📹 视频时长: ${duration} 秒`);
    
    // 【修复点】：直接读取底层返回的真实 downloads 列表，不再猜文件名
    // 优先展示本地路径，原始资源地址放在后面
    if (taskDetail.downloads && taskDetail.downloads.length > 0) {
      taskDetail.downloads.forEach(dl => {
        if (dl.download_success) {
          if (dl.type === 'video') {
            lines.push(`💾 视频本地路径: ${dl.local_path}`);
          } else if (dl.type === 'image') {
            lines.push(`🖼️ 尾帧本地路径: ${dl.local_path}`);
          } else {
            lines.push(`💾 ${dl.key}: ${dl.local_path}`);
          }
          lines.push(`🔗 原始资源地址（不要截断 URL）:`);
          lines.push(`\`\`\``);
          lines.push(`${dl.url}`);
          lines.push(`\`\`\``);
        } else {
          if (dl.type === 'video') {
            lines.push(`❌ 视频下载失败: ${dl.download_error}`);
          } else if (dl.type === 'image') {
            lines.push(`❌ 尾帧下载失败: ${dl.download_error}`);
          } else {
            lines.push(`❌ ${dl.key} 下载失败: ${dl.download_error}`);
          }
          lines.push(`🔗 原始资源地址: ${dl.url}`);
        }
      });
    }
    
    if (taskDetail.usage?.completion_tokens) {
      lines.push(`💰 消耗 Token: ${taskDetail.usage.completion_tokens}`);
    }
  }
  
  if (status === 'failed' && taskDetail.error) {
    lines.push(`❌ 失败原因: ${taskDetail.error.code}: ${taskDetail.error.message}`);
  }
  
  return lines.join('\n');
}

/**
 * 处理 create 命令
 * 用法: node seedance-wrapper.js create --prompt "xxx" [--model xxx]
 */
async function handleCreate(args) {
  // 🛡️ 先做参数命名兼容：自动转换下划线到中划线
  args = normalizeArgs(args);

  // 1. Agent Plan 智能意图识别与模型路由
  let prompt = '';
  let modelIndex = args.indexOf('--model');
  let promptIndex = args.indexOf('--prompt');
  let resolutionIndex = args.indexOf('--resolution');
  
  if (promptIndex !== -1) prompt = args[promptIndex + 1];
  
  // 🐛 Bug 修复：参数合法性本地校验，避免非法参数直接打到 API
  const durationIndex = args.indexOf('--duration');
  const ratioIndex = args.indexOf('--ratio');
  const serviceTierIndex = args.indexOf('--service-tier');
  
  // duration 校验: -1 或 4-15
  if (durationIndex !== -1) {
    const duration = parseInt(args[durationIndex + 1]);
    if (isNaN(duration) || (duration !== -1 && (duration < 4 || duration > 15))) {
      console.error(`❌ 参数校验失败: --duration 必须是 -1（自动）或 4-15 秒，当前值: ${args[durationIndex + 1]}`);
      process.exit(1);
    }
  }
  
  // ratio 校验: 枚举值
  const validRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'];
  if (ratioIndex !== -1 && !validRatios.includes(args[ratioIndex + 1])) {
    console.error(`❌ 参数校验失败: --ratio 支持的值: ${validRatios.join(' / ')}`);
    console.error(`   当前值: ${args[ratioIndex + 1]}`);
    process.exit(1);
  }
  
  // resolution 校验: 枚举值
  const validResolutions = ['480p', '720p', '1080p'];
  if (resolutionIndex !== -1 && !validResolutions.includes(args[resolutionIndex + 1])) {
    console.error(`❌ 参数校验失败: --resolution 支持的值: ${validResolutions.join(' / ')}`);
    console.error(`   当前值: ${args[resolutionIndex + 1]}`);
    process.exit(1);
  }
  
  // service-tier 校验: 枚举值
  const validServiceTiers = ['default', 'flex'];
  if (serviceTierIndex !== -1 && !validServiceTiers.includes(args[serviceTierIndex + 1])) {
    console.error(`❌ 参数校验失败: --service-tier 支持的值: ${validServiceTiers.join(' / ')}`);
    console.error(`   当前值: ${args[serviceTierIndex + 1]}`);
    process.exit(1);
  }
  
  // 🐛 Bug 修复：检测联网搜索参数（1.5 pro 不支持联网搜索）
  const enableWebSearchIndex = args.indexOf('--enable-web-search');
  const enableWebSearch = enableWebSearchIndex !== -1 && args[enableWebSearchIndex + 1] !== 'false';

  // 如果大模型没有显式指定模型，我们进行智能分配
  if (modelIndex === -1 && process.env.ARK_SEEDANCE_MODEL) {
    // 🐛 Bug 修复：支持 ARK_SEEDANCE_MODEL 环境变量 + 多模态/联网搜索兼容校验
    const envModel = process.env.ARK_SEEDANCE_MODEL;
    console.log(`🧠 读取环境变量 ARK_SEEDANCE_MODEL: ${envModel}`);
    
    // 多模态参考 / 联网搜索不支持 1.5 pro，必须用 2.0 系列
    const hasMedia = 
      args.includes('--image-file') || args.includes('--image-url') ||
      args.includes('--video-file') || args.includes('--video-url') ||
      args.includes('--audio-file') || args.includes('--audio-url');
    
    const is15pro = envModel.toLowerCase().includes('seedance-1-5') || envModel.toLowerCase().includes('seedance-1.5');
    
    if ((hasMedia || enableWebSearch) && is15pro) {
      const reason = hasMedia ? '多模态参考（图片/视频/音频）' : '联网搜索';
      console.log(`⚠️  [路由提示] 检测到 ${reason}，1.5 pro 模型不支持该功能`);
      console.log(`   已自动调整为 Seedance 2.0 系列模型`);
      // 移除 2.0 不支持的冲突参数
      args = removeArgPair(args, '--draft');
      args = removeArgPair(args, '--service-tier');
      console.log(`   已自动移除不兼容参数: --draft / --service-tier`);
      args.push('--model', 'doubao-seedance-2.0');
    } else {
      args.push('--model', envModel);
    }
  } else if (modelIndex === -1) {
    let selectedModel = 'doubao-seedance-2.0'; // AgentPlan 默认标准版
    let resolutionIndex2 = args.indexOf('--resolution');
    let resolution = resolutionIndex2 !== -1 ? args[resolutionIndex2 + 1] : '';
    let draftIndex = args.indexOf('--draft');
    
    // 修复 --draft false 误判：只有当值不为 false 时才算开启
    let isDraft = draftIndex !== -1 && args[draftIndex + 1] !== 'false';
    // 修复 service-tier flex 路由：同时检查参数值和 prompt 关键词
    let serviceTier = serviceTierIndex !== -1 ? args[serviceTierIndex + 1] : '';
    let isFlex = serviceTier === 'flex' || prompt.includes('离线') || prompt.includes('低成本');
    
    // 多模态参考 / 联网搜索不支持 1.5 pro，必须用 2.0 系列
    const hasMedia = 
      args.includes('--image-file') || args.includes('--image-url') ||
      args.includes('--video-file') || args.includes('--video-url') ||
      args.includes('--audio-file') || args.includes('--audio-url');

    // 🚨 联网搜索优先级最高：只要开启，强制用 2.0 系列，不降级到 1.5 pro
    if (enableWebSearch) {
      console.log(`⚠️  [路由提示] 检测到开启联网搜索，1.5 pro 模型不支持该功能`);
      console.log(`   已自动调整为 Seedance 2.0 系列模型`);
      selectedModel = prompt.includes('快速') ? 'doubao-seedance-2.0-fast' : 'doubao-seedance-2.0';
      // 移除 2.0 不支持的冲突参数
      args = removeArgPair(args, '--draft');
      args = removeArgPair(args, '--service-tier');
      console.log(`   已自动移除不兼容参数: --draft / --service-tier`);
    } else if (isDraft || isFlex || prompt.includes('样片') || prompt.includes('draft') || prompt.includes('预览')) {
      if (hasMedia) {
        // 🚨 冲突场景：多模态参考 + 低成本/样片 → 强制用 2.0，不降级到 1.5 pro
        console.log(`⚠️  [路由提示] 检测到多模态参考（图片/视频/音频），不支持 1.5 pro 模型`);
        console.log(`   已自动调整为 Seedance 2.0 系列模型`);
        selectedModel = 'doubao-seedance-2.0';
        // 移除 2.0 不支持的冲突参数
        args = removeArgPair(args, '--draft');
        args = removeArgPair(args, '--service-tier');
        console.log(`   已自动移除不兼容参数: --draft / --service-tier`);
      } else {
        selectedModel = 'doubao-seedance-1.5-pro'; // 只有 1.5 pro 支持样片和离线
      }
    } else if (resolution === '1080p' || prompt.includes('1080p') || prompt.includes('高清')) {
      selectedModel = 'doubao-seedance-2.0'; // fast 不支持 1080p
    } else if (prompt.includes('快速') || prompt.includes('fast') || prompt.includes('快点')) {
      selectedModel = 'doubao-seedance-2.0-fast';
    }
    
    args.push('--model', selectedModel);
    console.log(`🧠 [智能意图识别] 自动路由至模型: ${selectedModel}`);
  }

  // 2. 检查是否是同步等待模式
  const waitIndex = args.indexOf('--wait');
  const shouldWait = waitIndex !== -1 && args[waitIndex + 1] !== 'false' && args[waitIndex + 1] !== '0';
  
  // 3. 执行底层 create
  const result = execCLI(['create', ...args]);
  
  if (result.status !== 0) {
    console.error('❌ 任务创建失败');
    process.exit(result.status);
  }
  
  // 4. 解析 task_id
  const taskId = parseTaskIdFromOutput(result.stdout);
  if (!taskId) {
    console.error('⚠️ 无法解析任务 ID，已创建但未加入待办列表');
    process.exit(0);
  }
  
  // 重新获取确认使用的 model
  let finalModel = '';
  const finalModelIndex = args.indexOf('--model');
  if (finalModelIndex !== -1) finalModel = args[finalModelIndex + 1];
  
  if (!shouldWait) {
    // 异步模式：加入待办列表，后续 Cron 轮询
    addPendingTask(taskId, prompt, finalModel);
    
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ 视频生成任务已提交！');
    console.log(`🆔 任务 ID: ${taskId}`);
    console.log('');
    console.log('💡 你可以：');
    console.log('   - 问 "我的视频生成好了吗" 来查询进度');
    console.log(`   - 手动查询: node seedance-wrapper.js get --task-id ${taskId}`);
    console.log('   - Agent 框架 Cron 会自动定期检查，完成后通知你');
  } else {
    // 同步等待模式：任务已完成，不需要加入待办列表
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ 视频生成完成！');
    console.log(`🆔 任务 ID: ${taskId}`);
    console.log('');
    console.log('💡 已自动下载到本地目录，可以直接使用');
  }
}

/**
 * 处理 get 命令
 * 用法: node seedance-wrapper.js get --task-id xxx
 */
async function handleGet(args) {
  // 🛡️ 参数命名兼容
  args = normalizeArgs(args);

  // 【修复点】：给下载目录加上 task_id，防止多个任务文件覆盖
  let downloadDir;
  const dirIndex = args.indexOf('--download-dir');
  const taskIdIndex = args.indexOf('--task-id');
  const taskId = taskIdIndex !== -1 ? args[taskIdIndex + 1] : 'unknown';

  if (dirIndex !== -1) {
    downloadDir = args[dirIndex + 1];
  } else {
    downloadDir = path.join(DEFAULT_DOWNLOAD_DIR, taskId);
    args.push('--download-dir', downloadDir);
  }

  // 执行底层 get，静默模式防止 base64 图片泄露
  const result = execCLI(['get', ...args], { silent: true });
  
  if (result.status !== 0) {
    // 静默模式失败时打印错误
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status);
  }
  
  // 解析结果（支持混合日志 + JSON 输出）
  let taskDetail;
  try {
    taskDetail = safeJSONParse(result.stdout);
  } catch (e) {
    // 解析失败不打印原始 stdout（可能包含 base64 图片，避免 token 爆炸）
    console.log(`⚠️ 无法解析任务状态`);
    return;
  }
  
  // 查找待办信息
  const pendingTasks = getPendingTasks();
  const pendingInfo = pendingTasks.find(t => t.task_id === taskDetail.id);
  
  // 格式化输出 (传入 downloadDir)
  console.log('');
  console.log(formatTaskStatus(taskDetail, pendingInfo, downloadDir));
  console.log('');
  
  // 如果是终态，自动从待办列表移除
  const status = taskDetail.status;
  if (['succeeded', 'failed', 'cancelled', 'expired'].includes(status)) {
    removePendingTask(taskDetail.id);
  }
}

/**
 * 批量检查所有待办任务（给 Cron 用）
 * 用法: node seedance-wrapper.js check-pending
 */
async function handleCheckPending(args = []) {
  // 🛡️ 先做参数命名兼容
  args = normalizeArgs(args);
  
  const pendingTasks = getPendingTasks();
  
  if (pendingTasks.length === 0) {
    console.log('📭 没有待完成的任务');
    return;
  }
  
  console.log(`🔍 检查 ${pendingTasks.length} 个待完成任务...`);
  console.log('');
  
  const completedTasks = [];
  const inProgressTasks = [];
  
  for (const pendingTask of pendingTasks) {
    // 【修复点】：给下载目录加上 task_id，防止覆盖
    const taskDownloadDir = path.join(DEFAULT_DOWNLOAD_DIR, pendingTask.task_id);
    
    // 查询任务状态，同时自动下载到本地，静默模式防止 base64 泄露
    const result = execCLI(['get', ...args, '--task-id', pendingTask.task_id, '--download-dir', taskDownloadDir], { silent: true });
    
    if (result.status !== 0) {
      console.log(`❌ 查询任务 ${pendingTask.task_id} 失败`);
      if (result.stderr) {
        console.log(`   原因: ${result.stderr.trim()}`);
      }
      continue;
    }
    
    let taskDetail;
    try {
      taskDetail = safeJSONParse(result.stdout);
    } catch (e) {
      console.log(`⚠️ 无法解析任务 ${pendingTask.task_id} 的状态`);
      continue;
    }
    
    const status = taskDetail.status;
    
    // 【修复点】：把 taskDownloadDir 存起来传给后面的格式化函数
    if (['succeeded', 'failed', 'cancelled', 'expired'].includes(status)) {
      completedTasks.push({ pending: pendingTask, detail: taskDetail, downloadDir: taskDownloadDir });
    } else {
      inProgressTasks.push({ pending: pendingTask, detail: taskDetail });
    }
  }
  
  // 输出汇总
  console.log(`📊 检查完成：`);
  console.log(`   - 进行中: ${inProgressTasks.length}`);
  console.log(`   - 已完成: ${completedTasks.length}`);
  console.log('');
  
  // 详细输出已完成的任务
  if (completedTasks.length > 0) {
    console.log('🎉 以下任务已完成：');
    console.log('');
    
    for (const item of completedTasks) {
      // 【修复点】：传入 downloadDir 让 LLM 看到本地路径
      console.log(formatTaskStatus(item.detail, item.pending, item.downloadDir));
      console.log('');
      console.log('-'.repeat(50));
      console.log('');
      
      // 自动从待办列表移除
      removePendingTask(item.pending.task_id);
    }
  }
  
  // 如果有进行中的任务，也简要输出
  if (inProgressTasks.length > 0) {
    console.log('⚙️ 进行中的任务：');
    for (const item of inProgressTasks) {
      const elapsed = Math.floor((Date.now() - item.pending.created_at) / 1000 / 60);
      console.log(`   - ${item.pending.task_id} (${elapsed} 分钟) - ${item.detail.status}`);
    }
  }
}

/**
 * 处理 list 命令
 * 用法: node seedance-wrapper.js list [--status running]
 */
async function handleList(args) {
  // 🛡️ 参数命名兼容
  args = normalizeArgs(args);
  const result = execCLI(['list', ...args]);
  if (result.status !== 0) process.exit(result.status);
}

/**
 * 处理 delete 命令
 * 用法: node seedance-wrapper.js delete --task-id xxx
 */
async function handleDelete(args) {
  // 🛡️ 参数命名兼容
  args = expandEqualsArgs(args);
  args = normalizeArgs(args);
  
  // 先提取 task_id（无论删除成功失败都要清理本地 pending）
  let taskId;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task-id' && args[i+1]) taskId = args[i+1];
  }
  
  const result = execCLI(['delete', ...args]);
  
  // 即使云端删除失败，也要清理本地 pending，避免产生僵尸任务
  if (taskId) {
    try {
      removePendingTask(taskId);
    } catch (e) {
      // 静默失败，不影响主流程
    }
  }
  
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

/**
 * 主入口
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);
  
  switch (command) {
    case 'create':
      await handleCreate(commandArgs);
      break;
    case 'get':
      await handleGet(commandArgs);
      break;
    case 'check-pending':
      await handleCheckPending(commandArgs);
      break;
    case 'list':
      await handleList(commandArgs);
      break;
    case 'delete':
      await handleDelete(commandArgs);
      break;
    case 'help':
    default:
      console.log(`
Seedance Skill - 豆包视频生成 Agent 原生版

用法:
  node seedance-wrapper.js create [options]   创建视频任务（不阻塞，自动加入待办列表）
  node seedance-wrapper.js get --task-id <id>  查询单个任务（完成后自动从待办移除）
  node seedance-wrapper.js check-pending        批量检查所有待办任务（给 Cron 用）
  node seedance-wrapper.js list [options]       列出历史任务
  node seedance-wrapper.js delete --task-id <id> 删除任务
  node seedance-wrapper.js help                 显示帮助

所有 create/get/list/delete 命令透传参数给底层 seedance.js CLI，
支持的参数与底层 CLI 完全一致（--model, --prompt, --image-file 等）。

Agent 原生特性:
  - 自动维护 .pending-tasks.json 待办列表
  - 会话重启不丢失任务
  - 配合 Agent 框架 Cron 实现完成后自动通知
  - 自动下载到可用目录：~/Desktop/Seedance-Videos/、~/Seedance-Videos/ 或 ./Seedance-Videos/
      `.trim());
  }
}

main().catch(e => {
  console.error('❌ 执行失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
