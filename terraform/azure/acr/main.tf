resource "azurerm_resource_group" "rg" {
  name     = var.name
  location = var.location
}

resource "azurerm_container_registry" "acr" {
  name                   = var.name
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  sku                    = "Standard"
  admin_enabled          = true
  anonymous_pull_enabled = true
}
