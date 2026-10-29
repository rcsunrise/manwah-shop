# API 接入开发文档

本文档包含当前应用提供的核心 API 路由，供其他程序接入使用。所有接口默认需要携带认证信息。

## 认证方式 (Authentication)

多数接口支持以下两种认证头之一：
- **JWT 认证 (推荐)**: \`Authorization: Bearer <supabase_jwt_token>\`
- **User ID 兜底**: \`x-user-id: <user_uuid>\`

---

## 1. 图像生成接口 (Image Generation)

**请求路径:** \`POST /api/gateway/generate-image\`  
**Content-Type:** \`application/json\`

### 请求参数 (Request Body)
| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| \`prompt\` | string | 是 | 描述图像内容的提示词 |
| \`model\` | string | 否 | 模型名称，默认为 \`google/gemini-3-pro-image\` |
| \`aspectRatio\` | string | 否 | 宽高比，例如 \`"1:1"\`, \`"16:9"\` 或具体的尺寸如 \`"1024:1024"\` |
| \`images\` | array | 否 | 参考图像（Base64 编码的图像数据数组） |
| \`resolution\` | string | 否 | 清晰度/分辨率设置（如 \`1K\`, \`2K\`, \`4K\` 等） |
| \`seed\` | number | 否 | 随机种子，用于固定生成结果 |

### 响应内容
如果上游接口支持流式传输或直接返回完整结果，通常会包含在 JSON 结构中。响应中包含了经过计费扣减和可能的图片尺寸裁剪处理后的最终对象：

\`\`\`json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/jpeg",
              "data": "<Base64 图像数据>"
            }
          }
        ]
      }
    }
  ],
  "points_deducted": 1500,
  "error": null
}
\`\`\`
**注意：** 如果使用 \`aspectRatio\` 传入自定义尺寸且接口返回成功，系统会自动将结果缩放到指定的宽高并转换为 \`image/jpeg\`。

---

## 2. 蒙版预处理上传 (Mask Pre-processing)

**请求路径:** \`POST /api/pre_process/mask\`  
**Content-Type:** \`multipart/form-data\`

### 请求参数 (Form Data)
| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| \`clean_image\` | file | 是 | 原始干净图像 |
| \`mask_image\` | file | 是 | 对应的蒙版图像 |

### 响应内容
成功处理和压缩图片，并将其上传到云存储 (Supabase Storage)，然后返回对应的公网 URL。

\`\`\`json
{
  "success": true,
  "data": {
    "clean_image_url": "https://<supabase_url>/storage/v1/object/public/assets/clean_12345.jpg",
    "mask_image_url": "https://<supabase_url>/storage/v1/object/public/masks/mask_12345.png",
    "log": {
      "id": "...",
      "plugin_id": "mhyf_mask_tool_v1",
      "created_at": "..."
    }
  }
}
\`\`\`

---

## 3. 通用大模型代理转发 (AI Model Proxy)

**请求路径:** \`POST /v1beta/*\` 或 \`POST /v1alpha/*\` 或 \`POST /v1/*\`  
**Content-Type:** \`application/json\`

作为 Gemini / 路由网关的通用代理接口。它将把所有请求直接透传到配置的 \`baseUrl\`，并自动注入当前用户的 API 密钥或兜底密钥。

- 支持 Streaming (SSE)，会自动分块返回并从流中截获 \`usageMetadata\` 以进行计费。
- 响应 Header 中会附加 \`X-Proxy-Provider\` 标明实际调用的后端渠道（如 \`google\` 或 \`routerhub\`）。

---

## 4. 管理员接口 (Admin API)

以下接口主要供系统管理后台使用：

- \`POST /api/admin/test-connection\`: 测试填写的 API 配置（baseUrl 和 apiKey）是否有效。
- \`POST /api/admin/refund-log\`: 处理用户的扣费退款/补偿（需要包含对应 Token 数）。
- \`POST /api/admin/create-user\`: 创建子账号。
- \`POST /api/admin/reset-password\`: 重置指定账号密码。
- \`DELETE /api/admin/users/:userId\`: 删除子账号。

*注：部分管理接口通过内部鉴权判定是否具备操作权限。*
