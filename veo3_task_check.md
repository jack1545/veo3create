# 查询任务

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/video/query:
    get:
      summary: 查询任务
      deprecated: false
      description: |+
        给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。

        为提供的提示和参数创建完成

      tags:
        - 视频模型/veo 视频生成/视频统一格式
      parameters:
        - name: id
          in: query
          description: |
            任务ID
          required: true
          example: veo3:1753613210-OR998GOIzu
          schema:
            type: string
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
        - name: X-Forwarded-Host
          in: header
          description: ''
          required: false
          example: localhost:5173
          schema:
            type: string
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties: {}
            examples: {}
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
                  status:
                    type: string
                  video_url:
                    type: 'null'
                  enhanced_prompt:
                    type: string
                  status_update_time:
                    type: integer
                required:
                  - id
                  - status
                  - video_url
                  - enhanced_prompt
                  - status_update_time
              example:
                id: 033fa60e-f37c-4ff6-a44d-5585ffea938d
                status: pending
                video_url: null
                enhanced_prompt: >-
                  ```

                  A surreal and whimsical digital painting of a majestic brown
                  cow with large, feathered wings soaring gracefully through a
                  vibrant blue sky. The cow has a joyful expression, its tail
                  streaming behind it as it flies among fluffy white clouds.
                  Below, a patchwork of green farmland stretches into the
                  distance, with tiny farm buildings and a group of astonished
                  farmers looking up in amazement. The scene is bathed in warm
                  golden sunlight, creating a dreamlike and magical atmosphere.
                  Art style inspired by fantasy illustrations with soft
                  brushstrokes and rich, saturated colors.

                  ```
                status_update_time: 1750323167003
          headers: {}
          x-apifox-name: 成功
      security:
        - bearer: []
      x-apifox-folder: 视频模型/veo 视频生成/视频统一格式
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/5443236/apis/api-311081757-run
components:
  schemas: {}
  securitySchemes:
    bearer:
      type: http
      scheme: bearer
servers:
  - url: https://yunwu.ai
    description: 正式环境
security:
  - bearer: []

```