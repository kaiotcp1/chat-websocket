locals {
  # Controlam somente os workflows; nunca condicionam recursos Terraform.
  provision_infrastructure = true
  destroy_infrastructure   = false
}
