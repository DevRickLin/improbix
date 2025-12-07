'use client';

import { FileText, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportList } from '@/components/reports/report-list';
import { CollectedLinksList } from '@/components/reports/collected-links-list';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & History</h1>
        <p className="text-muted-foreground">
          Browse AI-generated reports and collected links
        </p>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Collected Links
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4">
          <ReportList />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <CollectedLinksList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
