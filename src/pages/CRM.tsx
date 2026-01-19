import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Upload, LayoutGrid, List } from 'lucide-react';
import { LeadKanban } from '@/components/crm/LeadKanban';
import { LeadTable } from '@/components/crm/LeadTable';
import { LeadImporter } from '@/components/crm/LeadImporter';
import { AddLeadDialog } from '@/components/crm/AddLeadDialog';

export default function CRM() {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [importerOpen, setImporterOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">CRM & Leads</h1>
            <p className="text-muted-foreground mt-1">
              Manage your sales pipeline and track lead conversions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImporterOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Button>
            <Button className="gradient-primary" onClick={() => setAddLeadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
          >
            <List className="h-4 w-4 mr-2" />
            Table
          </Button>
        </div>

        {/* Content */}
        {view === 'kanban' ? <LeadKanban /> : <LeadTable />}

        {/* Dialogs */}
        <LeadImporter open={importerOpen} onOpenChange={setImporterOpen} />
        <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />
      </div>
    </DashboardLayout>
  );
}