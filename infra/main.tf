provider "aws" {
  region = "us-east-1"
}

locals {
  name = var.project_name
  tags = { Project = var.project_name, ManagedBy = "Terraform" }
}

resource "aws_dynamodb_table" "connections" {
  name         = "${local.name}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }
  attribute {
    name = "roomId"
    type = "S"
  }

  global_secondary_index {
    name            = "roomId-index"
    hash_key        = "roomId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "connection" {
  name              = "/aws/lambda/${local.name}-connection"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "realtime" {
  name              = "/aws/lambda/${local.name}-realtime"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "connection" {
  name               = "${local.name}-connection-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = local.tags
}

resource "aws_iam_role" "realtime" {
  name               = "${local.name}-realtime-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "connection" {
  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.connections.arn]
  }
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.connection.arn}:*"]
  }
  statement {
    actions   = ["execute-api:ManageConnections"]
    resources = ["${aws_apigatewayv2_api.websocket.execution_arn}/v1/POST/@connections/*"]
  }
}

data "aws_iam_policy_document" "realtime" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.connections.arn, "${aws_dynamodb_table.connections.arn}/index/roomId-index"]
  }
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.realtime.arn}:*"]
  }
  statement {
    actions   = ["execute-api:ManageConnections"]
    resources = ["${aws_apigatewayv2_api.websocket.execution_arn}/v1/POST/@connections/*"]
  }
}

resource "aws_iam_role_policy" "connection" {
  name   = "${local.name}-connection"
  role   = aws_iam_role.connection.id
  policy = data.aws_iam_policy_document.connection.json
}

resource "aws_iam_role_policy" "realtime" {
  name   = "${local.name}-realtime"
  role   = aws_iam_role.realtime.id
  policy = data.aws_iam_policy_document.realtime.json
}

data "archive_file" "connection" {
  type        = "zip"
  source_file = "${path.module}/../dist/lambdas/connection.js"
  output_path = "${path.module}/../dist/connection.zip"
}

data "archive_file" "realtime" {
  type        = "zip"
  source_file = "${path.module}/../dist/lambdas/realtime.js"
  output_path = "${path.module}/../dist/realtime.zip"
}

resource "aws_lambda_function" "connection" {
  function_name    = "${local.name}-connection"
  role             = aws_iam_role.connection.arn
  handler          = "connection.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.connection.output_path
  source_code_hash = data.archive_file.connection.output_base64sha256
  timeout          = 10
  memory_size      = 256
  environment {
    variables = { CONNECTIONS_TABLE = aws_dynamodb_table.connections.name }
  }
  depends_on = [aws_cloudwatch_log_group.connection]
  tags       = local.tags
}

resource "aws_lambda_function" "realtime" {
  function_name    = "${local.name}-realtime"
  role             = aws_iam_role.realtime.arn
  handler          = "realtime.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.realtime.output_path
  source_code_hash = data.archive_file.realtime.output_base64sha256
  timeout          = 15
  memory_size      = 256
  environment {
    variables = { CONNECTIONS_TABLE = aws_dynamodb_table.connections.name }
  }
  depends_on = [aws_cloudwatch_log_group.realtime]
  tags       = local.tags
}

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${local.name}-websocket"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  tags                       = local.tags
}

resource "aws_apigatewayv2_integration" "connection" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.connection.invoke_arn
}

resource "aws_apigatewayv2_integration" "realtime" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.realtime.invoke_arn
}

resource "aws_apigatewayv2_route" "connect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.connection.id}"
  authorization_type = "NONE"
}
resource "aws_apigatewayv2_route" "disconnect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "$disconnect"
  target             = "integrations/${aws_apigatewayv2_integration.connection.id}"
  authorization_type = "NONE"
}
resource "aws_apigatewayv2_route" "default" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "$default"
  target             = "integrations/${aws_apigatewayv2_integration.realtime.id}"
  authorization_type = "NONE"
}
resource "aws_apigatewayv2_route" "join" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "joinRoom"
  target             = "integrations/${aws_apigatewayv2_integration.realtime.id}"
  authorization_type = "NONE"
}
resource "aws_apigatewayv2_route" "leave" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "leaveRoom"
  target             = "integrations/${aws_apigatewayv2_integration.realtime.id}"
  authorization_type = "NONE"
}
resource "aws_apigatewayv2_route" "message" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "sendMessage"
  target             = "integrations/${aws_apigatewayv2_integration.realtime.id}"
  authorization_type = "NONE"
}
resource "aws_apigatewayv2_route" "typing" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "typing"
  target             = "integrations/${aws_apigatewayv2_integration.realtime.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "connection" {
  statement_id  = "AllowApiGatewayConnection"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connection.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}

resource "aws_lambda_permission" "realtime" {
  statement_id  = "AllowApiGatewayRealtime"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.realtime.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}

resource "aws_apigatewayv2_stage" "v1" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "v1"
  auto_deploy = true
  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 20
    throttling_rate_limit    = 10
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.realtime.arn
    format          = jsonencode({ requestId = "$context.requestId", routeKey = "$context.routeKey", status = "$context.status", connectionId = "$context.connectionId" })
  }
  tags = local.tags
}
