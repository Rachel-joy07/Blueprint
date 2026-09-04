// This mirrors the exact JSON shape your Azure Function should return from
// POST /api/scan. Swap the fetch in App.jsx from mock -> real endpoint once
// the backend rule engine is working. Keep this file as your fallback/demo
// fixture in case wifi dies during your presentation.

export const mockScan = {
  fileName: 'main.tf',
  source: `resource "azurerm_virtual_network" "core" {
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

  # Inbound rule for SSH management access.
  # NOTE: this is scoped far too broadly - flagged by Blueprint below.
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
  admin_username      = "azureuser"
}


resource "azurerm_storage_account" "data" {
  name                 = "appdata"
  resource_group_name  = "demo-rg"
  location             = "eastus"
  account_tier         = "Standard"











  allow_blob_public_access = true
}


resource "azurerm_mssql_database" "app" {
  name      = "app-db"
  server_id = azurerm_mssql_server.app.id
  sku_name  = "S1"
}

resource "azurerm_public_ip" "unused" {
  name                = "app-ip"
  resource_group_name = "demo-rg"
  location            = "eastus"
  allocation_method   = "Static"
}`,
  summary: {
    resourceCount: 7,
    riskCount: 2,
    wasteCount: 2,
    monthlyCostActual: 1683,
    monthlyCostOptimized: 412,
    riskScore: 68 // 0-100, higher = worse
  },
  nodes: [
    {
      id: 'vnet',
      type: 'azurerm_virtual_network',
      label: 'core-vnet',
      status: 'clean',
      x: 80, y: 220
    },
    {
      id: 'subnet',
      type: 'azurerm_subnet',
      label: 'app-subnet',
      status: 'clean',
      x: 340, y: 220
    },
    {
      id: 'nsg',
      type: 'azurerm_network_security_group',
      label: 'app-nsg',
      status: 'risk',
      x: 600, y: 80,
      issue: {
        severity: 'risk',
        title: 'SSH open to the entire internet',
        rule_id: 'open_ssh',
        line: 42,
        code: `security_rule {\n  destination_port_range = "22"\n  source_address_prefix  = "0.0.0.0/0"\n  access                 = "Allow"\n}`,
        explanation:
          'Port 22 (SSH) accepts inbound traffic from any IP address. Any host on the internet can attempt to log into your VM.',
        fix: 'Restrict source_address_prefix to your office/VPN CIDR block, e.g. "203.0.113.0/24", or route SSH through Azure Bastion instead.',
        compliance: [
          { framework: 'CIS Azure Benchmark', control: '6.2', description: "Ensure SSH access is restricted from the internet" },
          { framework: 'PCI-DSS', control: '1.2.1', description: "Restrict inbound traffic to only what's necessary" },
          { framework: 'SOC 2', control: 'CC6.6', description: 'Logical access is restricted to authorized users' }
        ]
      }
    },
    {
      id: 'vm',
      type: 'azurerm_linux_virtual_machine',
      label: 'app-server',
      status: 'waste',
      x: 600, y: 320,
      issue: {
        severity: 'waste',
        title: 'Oversized VM for the workload',
        rule_id: 'oversized_vm',
        line: 67,
        code: `resource "azurerm_linux_virtual_machine" "app" {\n  size = "Standard_D64s_v3"\n  ...\n}`,
        explanation:
          'This is a 64-core / 256GB RAM VM. Nothing else in this file suggests a workload that needs that scale (no load balancer, no autoscale set, single instance).',
        fix: 'Standard_D4s_v3 (4 vCPU / 16GB) comfortably covers a typical single-instance web app and cuts cost by ~80%.',
        costActual: 1401,
        costOptimized: 210,
        compliance: [
          { framework: 'Azure Well-Architected Framework', control: 'Cost Optimization', description: 'Right-size resources to match actual workload demand' }
        ]
      }
    },
    {
      id: 'storage',
      type: 'azurerm_storage_account',
      label: 'appdata',
      status: 'risk',
      x: 860, y: 220,
      issue: {
        severity: 'risk',
        title: 'Public blob access enabled',
        rule_id: 'public_blob_access',
        line: 89,
        code: `resource "azurerm_storage_account" "data" {\n  allow_blob_public_access = true\n}`,
        explanation:
          'Any blob container in this storage account can be configured to be readable by anyone on the internet with the URL, no authentication required.',
        fix: 'Set allow_blob_public_access = false. Use SAS tokens or Azure AD auth for controlled access instead.',
        compliance: [
          { framework: 'CIS Azure Benchmark', control: '3.7', description: 'Ensure default network access rule is set to deny' },
          { framework: 'SOC 2', control: 'CC6.1', description: 'Logical access to protected information is restricted' },
          { framework: 'HIPAA', control: '§164.312(a)(1)', description: 'Access control over systems holding ePHI' }
        ]
      }
    },
    {
      id: 'db',
      type: 'azurerm_mssql_database',
      label: 'app-db',
      status: 'clean',
      x: 340, y: 400
    },
    {
      id: 'ip',
      type: 'azurerm_public_ip',
      label: 'app-ip',
      status: 'waste',
      x: 860, y: 400,
      issue: {
        severity: 'waste',
        title: 'Static public IP, but nothing uses it',
        rule_id: 'unattached_public_ip',
        line: 103,
        code: `resource "azurerm_public_ip" "unused" {\n  allocation_method = "Static"\n}`,
        explanation:
          'This IP resource is defined but never referenced by a NIC, load balancer, or gateway anywhere else in the file.',
        fix: 'Remove it, or attach it to the intended resource. An unattached static IP still bills monthly.',
        costActual: 4,
        costOptimized: 0,
        compliance: [
          { framework: 'Azure Well-Architected Framework', control: 'Cost Optimization', description: 'Eliminate unused or orphaned resources' }
        ]
      }
    }
  ],
  edges: [
    { source: 'vnet', target: 'subnet' },
    { source: 'subnet', target: 'nsg' },
    { source: 'subnet', target: 'vm' },
    { source: 'subnet', target: 'db' },
    { source: 'vm', target: 'storage' },
    { source: 'vm', target: 'ip' }
  ]
}
