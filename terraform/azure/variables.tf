variable "prefix" {
  default = ""
}

variable "location" {
  default = "westus2"
  type    = string
}

variable "kubernetes_version" {
  default = "1.29.2"
  type    = string
}

variable "sku_tier" {
  default = "Free"
  type    = string
}

variable "system_nodepool" {
  type = object({
    name = string
    size = string
    min  = number
    max  = number
  })
  default = {
    name = "agentpool"
    size = "Standard_DS2_v2"
    min  = 2
    max  = 3
  }
}

variable "user_nodepools" {
  type = list(object({
    name       = string
    size       = string
    node_count = number
    max_pods   = number
    labels     = map(string)
    taints     = list(string)
  }))
  default = [{
    name       = "shim"
    size       = "Standard_DS2_v2"
    node_count = 1
    max_pods   = 250
    labels = {
      "runtime" = "containerd-shim-spin"
    }
    taints = []
  }]
}

variable "tags" {
  description = "Map of extra tags to attach to items which accept them"
  type        = map(string)
  default     = {}
}

# TODO: see monitoring.tf
#
# variable "grafana_admins" {
#   description = "List of object id's to be assigned as Grafana admins"
#   type = list(string)
#   default = []
# }

# variable "metric_annotations_allowlist" {
#   description = "Specifies a list of Kubernetes annotation keys that will be used in the resource's labels metric."
#   type        = list(string)
#   default     = []
# }

# variable "metric_labels_allowlist" {
#   description = "(Optional) Specifies a Comma-separated list of additional Kubernetes label keys that will be used in the resource's labels metric."
#   type        = list(string)
#   default     = []
# }
