locals {
  # Controlam somente os workflows; nunca condicionam recursos Terraform.
  provision_infrastructure = false
  destroy_infrastructure   = false
}
