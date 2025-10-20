# 创建视频 sora-2-pro

## 调用示例

- Python请求

```python
import http.client
import json

conn = http.client.HTTPSConnection("yunwu.ai")
payload = json.dumps({
   "images": [],
   "model": "sora-2",
   "orientation": "portrait",
   "prompt": "Two huskies were playing in a courtyard when suddenly a white cat came into the camera and the white cat gave a cry. A husky crashed into the gate in a panic and passed out. Another husky climbed the wall and ran away. The environment is a stone road in front of the courtyard gate.",
   "size": "large",
   "duration": 15
})
headers = {
   'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
   'Content-Type': 'application/json',
   'Authorization': 'Bearer sk-YI0G381LDzEafR9cWToAlzzyZwTutwOFnqbBNugM8Vgyixbw',
   'Accept': '*/*',
   'Host': 'yunwu.ai',
   'Connection': 'keep-alive'
}
conn.request("POST", "/v1/video/create", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

- 返回body

```json
{
    "id": "sora-2:task_01k7znn323fywsam5cjy0btrwj",
    "status": "pending",
    "status_update_time": 1760925748868
}
```


## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/video/create:
    post:
      summary: 创建视频 sora-2-pro
      deprecated: false
      description: ''
      tags:
        - 视频模型/sora 视频生成/异步格式
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: true
          example: application/json
          schema:
            type: string
        - name: Accept
          in: header
          description: ''
          required: true
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                images:
                  type: array
                  items:
                    type: string
                  description: 图片链接
                model:
                  type: string
                  description: 模型名字
                orientation:
                  type: string
                  description: |
                    portrait 竖屏
                    landscape 横屏
                prompt:
                  type: string
                  description: 提示词
                size:
                  type: string
                  description: large 高清1080p
                duration:
                  type: string
                  description: 支持 15
              required:
                - images
                - model
                - orientation
                - prompt
                - size
                - duration
              x-apifox-orders:
                - images
                - model
                - orientation
                - prompt
                - size
                - duration
            example:
              images: []
              model: sora-2-pro
              orientation: portrait
              prompt: make animate
              size: large
              duration: 15
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  object:
                    type: string
                  created:
                    type: integer
                  choices:
                    type: array
                    items:
                      type: object
                      properties:
                        index:
                          type: integer
                        message:
                          type: object
                          properties:
                            role:
                              type: string
                            content:
                              type: string
                          required:
                            - role
                            - content
                          x-apifox-orders:
                            - role
                            - content
                        finish_reason:
                          type: string
                      x-apifox-orders:
                        - index
                        - message
                        - finish_reason
                  usage:
                    type: object
                    properties:
                      prompt_tokens:
                        type: integer
                      completion_tokens:
                        type: integer
                      total_tokens:
                        type: integer
                    required:
                      - prompt_tokens
                      - completion_tokens
                      - total_tokens
                    x-apifox-orders:
                      - prompt_tokens
                      - completion_tokens
                      - total_tokens
                required:
                  - id
                  - object
                  - created
                  - choices
                  - usage
                x-apifox-orders:
                  - id
                  - object
                  - created
                  - choices
                  - usage
          headers: {}
          x-apifox-name: OK
      security:
        - bearer: []
      x-apifox-folder: 视频模型/sora 视频生成/异步格式
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/5443236/apis/api-358742580-run
components:
  schemas: {}
  securitySchemes:
    bearer:
      type: http
      scheme: bearer
servers:
  - url: http://yunwu.ai
    description: 正式环境
security:
  - bearer: []

```