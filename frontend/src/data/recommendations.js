// This is the deterministic fallback the chat assistant uses when there's
// no backend /api/suggest wired up (or the API call fails). It keeps the
// demo alive without any external dependency, and honestly it's a
// perfectly legitimate MVP for a 1-week project on its own - the backend
// version in `suggest.py` can layer an LLM on top of this same knowledge
// base for more open-ended phrasing later, if you have time.

export const RECOMMENDATIONS = [
  {
    keywords: ['cheap database', 'budget database', 'small database', 'low cost db'],
    title: 'Budget-friendly database',
    suggestion: 'azurerm_mssql_database — Basic tier',
    reasoning:
      'Basic tier handles light workloads (small apps, dev/test) at a fraction of Standard/Premium cost.',
    snippet: `resource "azurerm_mssql_database" "app" {\n  name      = "app-db"\n  server_id = azurerm_mssql_server.app.id\n  sku_name  = "Basic"\n}`,
    estCost: '~$5/mo'
  },
  {
    keywords: ['secure storage', 'private storage', 'encrypted storage'],
    title: 'Locked-down storage account',
    suggestion: 'azurerm_storage_account with public access disabled',
    reasoning:
      'Blocks public blob access by default and enforces HTTPS-only, closing the two most common storage misconfigurations.',
    snippet: `resource "azurerm_storage_account" "data" {\n  name                      = "appdata"\n  allow_blob_public_access  = false\n  enable_https_traffic_only = true\n}`,
    estCost: '~$2-20/mo depending on usage'
  },
  {
    keywords: ['small vm', 'cheap vm', 'dev vm', 'test vm', 'budget vm', 'small server'],
    title: 'Right-sized dev/test VM',
    suggestion: 'azurerm_linux_virtual_machine — Standard_B2s',
    reasoning:
      'Burstable B-series is built for light, non-continuous workloads like dev/test boxes — far cheaper than general-purpose D-series.',
    snippet: `resource "azurerm_linux_virtual_machine" "dev" {\n  name = "dev-server"\n  size = "Standard_B2s"\n}`,
    estCost: '~$30/mo'
  },
  {
    keywords: ['static website', 'static site', 'landing page', 'host website'],
    title: 'Static site hosting',
    suggestion: 'azurerm_storage_account static website hosting',
    reasoning:
      'For a static site, a full VM or App Service is overkill. Storage account static hosting + CDN is dramatically cheaper.',
    snippet: `resource "azurerm_storage_account" "site" {\n  name = "myappsite"\n  static_website {\n    index_document = "index.html"\n  }\n}`,
    estCost: '~$1-5/mo'
  },
  {
    keywords: ['restrict ssh', 'lock down ssh', 'secure ssh', 'fix ssh'],
    title: 'SSH access restricted to a known network',
    suggestion: 'azurerm_network_security_group rule scoped to your CIDR',
    reasoning: 'Replaces 0.0.0.0/0 with a specific office/VPN range so SSH is not exposed to the whole internet.',
    snippet: `security_rule {\n  destination_port_range = "22"\n  source_address_prefix  = "203.0.113.0/24"\n  access                 = "Allow"\n}`,
    estCost: 'no cost impact'
  },
  {
    keywords: ['autoscale', 'scale automatically', 'handle traffic spikes'],
    title: 'Autoscaling compute',
    suggestion: 'azurerm_linux_virtual_machine_scale_set',
    reasoning: 'Scale sets add/remove instances based on load, instead of paying for peak capacity 24/7.',
    snippet: `resource "azurerm_linux_virtual_machine_scale_set" "app" {\n  name = "app-vmss"\n  sku  = "Standard_D2s_v3"\n  instances = 2\n}`,
    estCost: 'varies with scale, typically 30-60% cheaper than static peak sizing'
  }
]

export function matchRecommendation(userText) {
  const text = userText.toLowerCase()
  let best = null
  let bestScore = 0

  for (const rec of RECOMMENDATIONS) {
    for (const kw of rec.keywords) {
      if (text.includes(kw)) {
        const score = kw.length
        if (score > bestScore) {
          bestScore = score
          best = rec
        }
      }
    }
  }

  // Loose fallback: single-word overlap (e.g. "database", "vm", "storage")
  if (!best) {
    const words = text.split(/\s+/)
    for (const rec of RECOMMENDATIONS) {
      const hit = rec.keywords.some((kw) => words.some((w) => kw.includes(w) && w.length > 3))
      if (hit) {
        best = rec
        break
      }
    }
  }

  return best
}
