output "websocket_url" {
  value       = "${aws_apigatewayv2_api.websocket.api_endpoint}/${aws_apigatewayv2_stage.v1.name}"
  description = "Set this value as NEXT_PUBLIC_WS_URL in .env.local."
}

output "connections_table_name" {
  value = aws_dynamodb_table.connections.name
}

output "aws_region" {
  value = "us-east-1"
}
