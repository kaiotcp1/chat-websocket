variable "project_name" {
  description = "Prefix for all application resources. The Terraform state bucket is deliberately not managed here."
  type        = string
  default     = "realtime-rooms"
}

variable "log_retention_days" {
  type    = number
  default = 14
}
