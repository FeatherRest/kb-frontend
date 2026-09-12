/**
 * 各解析器的工作流示意图数据（与 Dashboard KnowledgePage.tsx 的 PARSER_WORKFLOWS 一致）。
 * key = /api/knowledge/parsers 返回的 name；未命中时回退 DEFAULT_WORKFLOW。
 * 内容与 hub/knowledge/parser.py 的实际路由保持一致。
 */
export const STAGE_ROLE_META = {
  input: { label: '输入', type: 'info' },
  process: { label: '处理', type: 'default' },
  branch: { label: '分支', type: 'warning' },
  output: { label: '输出', type: 'success' },
}

export const PARSER_WORKFLOWS = {
  纯文本: [
    { role: 'input', label: '输入文件', desc: '.txt / .md / .csv / .json / .yaml / .yml，扩展名 + magic bytes 识别' },
    { role: 'process', label: '敏感内容扫描', desc: 'detect_sensitive_content 扫描密钥/凭据，命中仅标记不阻断' },
    { role: 'branch', label: '结构化解析', desc: 'CSV→表格结构、JSON→路径分段、YAML→区块；其余 UTF-8 直接读取' },
    { role: 'output', label: '输出 Markdown', desc: '归档 md + meta 四件套，供切块与向量化' },
  ],
  'Office 文档': [
    { role: 'input', label: '输入文件', desc: '.docx（Office Open XML）' },
    { role: 'process', label: 'MarkItDown (mammoth)', desc: '子进程调用 MarkItDown CLI 转换正文为 Markdown' },
    { role: 'branch', label: '内嵌图片分析', desc: '图片占位符 → OCR + VLM 分析后按位置回填' },
    { role: 'output', label: '输出 Markdown', desc: '正文 + 图片描述合并输出' },
  ],
  'Excel 旧版': [
    { role: 'input', label: '输入文件', desc: '.xls（老式二进制工作簿）' },
    { role: 'process', label: 'MarkItDown (xlrd)', desc: 'XlsConverter 读取工作表与单元格' },
    { role: 'output', label: '输出 Markdown', desc: '工作表转 Markdown 表格' },
  ],
  'Excel 新版': [
    { role: 'input', label: '输入文件', desc: '.xlsx（Office Open XML）' },
    { role: 'process', label: 'openpyxl 自定义解析', desc: '遍历工作表/单元格，结构感知提取' },
    { role: 'output', label: '输出 Markdown', desc: '表格转 Markdown，附带 chunk_strategy' },
  ],
  'PPT 新版': [
    { role: 'input', label: '输入文件', desc: '.pptx（Office Open XML）' },
    { role: 'process', label: 'python-pptx 提取', desc: '遍历幻灯片文本与形状' },
    { role: 'branch', label: '内嵌图片分析', desc: '图片占位符 → OCR + VLM 分析后回填' },
    { role: 'output', label: '输出 Markdown', desc: '按幻灯片输出，chunk_strategy=pptx_slides' },
  ],
  'Word 旧版': [
    { role: 'input', label: '输入文件', desc: '.doc（OLE 复合文档）' },
    { role: 'process', label: 'olefile 解析', desc: '提取 WordDocument 文本流' },
    { role: 'output', label: '输出 Markdown', desc: '文本流转 Markdown' },
  ],
  'PPT 旧版': [
    { role: 'input', label: '输入文件', desc: '.ppt（OLE 复合文档）' },
    { role: 'process', label: 'olefile 解析', desc: '提取幻灯片文本' },
    { role: 'output', label: '输出 Markdown', desc: '文本流转 Markdown' },
  ],
  富文本: [
    { role: 'input', label: '输入文件', desc: '.rtf（富文本格式）' },
    { role: 'process', label: 'striprtf 剥离', desc: '去除 RTF 控制字/分组，保留纯文本' },
    { role: 'output', label: '输出 Markdown', desc: '纯文本转 Markdown' },
  ],
  'PDF（文字型）': [
    { role: 'input', label: '输入文件', desc: '.pdf，magic %PDF- 识别' },
    { role: 'process', label: '逐页画像', desc: 'PyMuPDF 统计每页字符数 / 图片数' },
    { role: 'branch', label: '页面分类', desc: 'all_text（全文字页）/ all_scan / mixed / blank' },
    { role: 'process', label: '文字页解析', desc: 'Docling（启用时）或 MarkItDown / pdf_tables 表格增强' },
    { role: 'branch', label: '混合页逐页路由', desc: 'pdf_pagewise：文字页 PyMuPDF 原生提取，扫描页 MinerU 分段 OCR' },
    { role: 'output', label: '输出 Markdown', desc: '合并页级结果输出' },
  ],
  'PDF（扫描/复杂）': [
    { role: 'input', label: '输入文件', desc: '.pdf，magic %PDF- 识别' },
    { role: 'process', label: '逐页画像', desc: 'PyMuPDF 统计每页字符数 / 图片数' },
    { role: 'branch', label: '页面分类', desc: '全扫描页 / 空白 → 整体走 OCR 管线' },
    { role: 'process', label: 'MinerU OCR 管线', desc: 'Docker 后端：版面分析、表格、公式、图片理解（中英）' },
    { role: 'process', label: '后处理', desc: '可选版面坐标附录（content_list bbox）' },
    { role: 'output', label: '输出 Markdown', desc: 'OCR 结果转 Markdown' },
  ],
  网页: [
    { role: 'input', label: '输入文件', desc: '.html / .htm / .xhtml' },
    { role: 'process', label: 'MarkItDown 转换', desc: 'HTML → Markdown，去标签保留结构' },
    { role: 'output', label: '输出 Markdown', desc: '输出网页正文' },
  ],
  图片: [
    { role: 'input', label: '输入文件', desc: '.jpg / .jpeg / .png / .bmp / .tiff / .tif / .webp' },
    { role: 'branch', label: 'OCR 文字提取', desc: 'RapidOCR (ONNX)：文字行 + bbox + 置信度' },
    { role: 'process', label: 'VLM 视觉理解', desc: 'Ollama qwen3.5:9b-nothink：内容/主题/布局/颜色描述' },
    { role: 'output', label: '合并输出', desc: 'Markdown（OCR 文本 + 视觉描述）+ JSON 结构化' },
  ],
  视频: [
    { role: 'input', label: '输入文件', desc: '.mp4 / .mov / .mkv / .avi / .webm / .flv / .wmv' },
    { role: 'process', label: '元数据', desc: 'ffprobe 读取时长/编码/分辨率' },
    { role: 'process', label: '字幕提取', desc: '内嵌字幕流（如有）' },
    { role: 'process', label: '语音转写', desc: '音频 → faster-whisper 转写' },
    { role: 'process', label: '场景关键帧', desc: '场景检测抽帧' },
    { role: 'branch', label: '关键帧分析', desc: 'RapidOCR 文字识别 + VLM 视觉描述（可选）' },
    { role: 'output', label: '合并输出', desc: 'Markdown 汇总，逐层降级，部分失败保留结果' },
  ],
}

export const DEFAULT_WORKFLOW = [
  { role: 'input', label: '输入文件', desc: '文件上传 / 检测' },
  { role: 'process', label: '类型检测', desc: '扩展名 + magic bytes 路由' },
  { role: 'process', label: '解析', desc: '调用对应解析引擎' },
  { role: 'output', label: '输出 Markdown', desc: '归档 + 摄取' },
]

/** 按解析器名称取工作流（未命中回退默认） */
export function workflowFor(name) {
  return PARSER_WORKFLOWS[name] || DEFAULT_WORKFLOW
}
