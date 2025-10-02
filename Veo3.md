# 创建视频，带图片

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
      summary: 创建视频，带图片
      deprecated: false
      description: ''
      tags:
        - 视频模型/veo 视频生成/视频统一格式
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
                model:
                  type: string
                  description: |-
                    枚举值:
                    veo2
                    veo2-fast
                    veo2-fast-frames
                    veo2-fast-components
                    veo2-pro
                    veo3
                    veo3-fast
                    veo3-pro
                    veo3-pro-frames
                    veo3-fast-frames
                    veo3-frames
                prompt:
                  type: string
                  description: 提示词
                images:
                  type: array
                  items:
                    type: string
                  description: >
                    当模型是带 veo2-fast-frames 最多支持两个，分别是首尾帧，当模型是 veo3-pro-frames
                    最多支持一个首帧，当模型是 veo2-fast-components 最多支持 3 个，此时图片为视频中的元素
                enhance_prompt:
                  type: boolean
                  description: |
                    由于 veo 只支持英文提示词，所以如果需要中文自动转成英文提示词，可以开启此开关
                enable_upsample:
                  type: string
                  description: 超分
                aspect_ratio:
                  type: string
                  description: |
                    ⚠️仅veo3支持，“16:9”或“9:16”
              required:
                - model
                - prompt
                - enhance_prompt
                - enable_upsample
                - aspect_ratio
              x-apifox-orders:
                - model
                - prompt
                - images
                - enhance_prompt
                - enable_upsample
                - aspect_ratio
            example:
              prompt: 牛飞上天了
              model: veo3-fast-frames
              images:
                - >-
                  https://filesystem.site/cdn/20250612/VfgB5ubjInVt8sG6rzMppxnu7gEfde.png
                - >-
                  https://filesystem.site/cdn/20250612/998IGmUiM2koBGZM3UnZeImbPBNIUL.png
              enhance_prompt: true
              enable_upsample: true
              aspect_ratio: '16:9'
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
      x-apifox-folder: 视频模型/veo 视频生成/视频统一格式
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/5443236/apis/api-311083745-run
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