terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    bucket       = "terraform-states-761018861028-us-east-1"
    key          = "websocket-message/prod/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }

  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.0" }
  }
}
