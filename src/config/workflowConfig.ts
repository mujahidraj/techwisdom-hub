// =============================================
// Workflow Automation Configuration
// =============================================

export const TRIGGER_TYPES = [
  { value: 'lead_created', label: 'New Lead Created', table: 'leads', event: 'INSERT' },
  { value: 'lead_status_changed', label: 'Lead Status Changed', table: 'leads', event: 'UPDATE' },
  { value: 'project_created', label: 'New Project Created', table: 'active_projects', event: 'INSERT' },
  { value: 'project_stage_changed', label: 'Project Stage Changed', table: 'active_projects', event: 'UPDATE' },
  { value: 'project_completed', label: 'Project Completed', table: 'active_projects', event: 'UPDATE' },
  { value: 'invoice_created', label: 'New Invoice Created', table: 'invoices', event: 'INSERT' },
  { value: 'expense_added', label: 'New Expense Added', table: 'expenses', event: 'INSERT' },
  { value: 'employee_added', label: 'New Employee Added', table: 'employees', event: 'INSERT' },
  { value: 'leave_requested', label: 'Leave Request Submitted', table: 'leave_applications', event: 'INSERT' },
  { value: 'asset_assigned', label: 'Asset Assigned', table: 'assets', event: 'UPDATE' },
  { value: 'ticket_opened', label: 'Helpdesk Ticket Opened', table: 'helpdesk_tickets', event: 'INSERT' },
  { value: 'ticket_escalated', label: 'Ticket Priority Escalated', table: 'helpdesk_tickets', event: 'UPDATE' },
  { value: 'appraisal_completed', label: 'Performance Review Completed', table: 'performance_reviews', event: 'UPDATE' },
  { value: 'candidate_hired', label: 'ATS Candidate Hired', table: 'ats_candidates', event: 'UPDATE' },
  { value: 'contract_renewed', label: 'Maintenance Contract Renewed', table: 'maintenance_contracts', event: 'UPDATE' },
];

export const ACTION_TYPES = [
  { value: 'send_notification', label: 'Show In-App Notification', icon: '🔔' },
  { value: 'create_note', label: 'Create a Note', icon: '📝' },
  { value: 'update_field', label: 'Update a Database Field', icon: '✏️' },
  { value: 'send_webhook', label: 'Send Webhook (HTTP POST)', icon: '🌐' },
  { value: 'log_activity', label: 'Log to Audit Trail', icon: '📋' },
  { value: 'create_task', label: 'Assign Auto-Task Checklist', icon: '✅' },
  { value: 'slack_webhook', label: 'Post to Slack Channel', icon: '💬' },
];

// Condition operators for trigger_config filters
export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
];

// Fields available per trigger for conditions
export const TRIGGER_FIELDS: Record<string, { value: string; label: string }[]> = {
  lead_created: [
    { value: 'source', label: 'Lead Source' },
    { value: 'category', label: 'Category' },
    { value: 'budget', label: 'Budget' },
  ],
  lead_status_changed: [
    { value: 'status', label: 'New Status' },
    { value: 'category', label: 'Category' },
  ],
  project_created: [
    { value: 'project_type', label: 'Project Type' },
    { value: 'total_budget', label: 'Budget' },
  ],
  project_stage_changed: [
    { value: 'stage', label: 'New Stage' },
    { value: 'project_type', label: 'Project Type' },
  ],
  project_completed: [
    { value: 'project_type', label: 'Project Type' },
  ],
  invoice_created: [
    { value: 'total', label: 'Invoice Total' },
  ],
  expense_added: [
    { value: 'category', label: 'Category' },
    { value: 'amount', label: 'Amount' },
  ],
  employee_added: [],
  leave_requested: [
    { value: 'leave_type', label: 'Leave Type' },
  ],
  asset_assigned: [
    { value: 'category', label: 'Asset Category' },
  ],
  ticket_opened: [
    { value: 'priority', label: 'Ticket Priority' },
    { value: 'category', label: 'Ticket Category' },
  ],
  ticket_escalated: [
    { value: 'priority', label: 'New Priority' },
    { value: 'status', label: 'Ticket Status' },
  ],
  appraisal_completed: [
    { value: 'overall_score', label: 'Appraisal Score' },
  ],
  candidate_hired: [
    { value: 'status', label: 'Candidate Stage' },
  ],
  contract_renewed: [
    { value: 'status', label: 'Contract Status' },
  ],
};

