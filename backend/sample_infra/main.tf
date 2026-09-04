resource "azurerm_virtual_network" "core" {
  name                = "core-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = "eastus"
  resource_group_name = "demo-rg"
}

resource "azurerm_subnet" "app" {
  name                 = "app-subnet"
  virtual_network_name = azurerm_virtual_network.core.name
  resource_group_name  = "demo-rg"
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_network_security_group" "app" {
  name                = "app-nsg"
  location            = "eastus"
  resource_group_name = "demo-rg"

  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "0.0.0.0/0"
    destination_address_prefix = "*"
  }
}

resource "azurerm_linux_virtual_machine" "app" {
  name                = "app-server"
  resource_group_name = "demo-rg"
  location            = "eastus"
  size                = "Standard_D64s_v3"
  subnet_id           = azurerm_subnet.app.id
}

resource "azurerm_storage_account" "data" {
  name                      = "appdata"
  resource_group_name       = "demo-rg"
  location                  = "eastus"
  account_tier              = "Standard"
  allow_blob_public_access  = true
}

resource "azurerm_public_ip" "unused" {
  name                = "app-ip"
  resource_group_name = "demo-rg"
  location            = "eastus"
  allocation_method   = "Static"
}
