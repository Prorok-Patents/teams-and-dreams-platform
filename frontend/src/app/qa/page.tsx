'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { fetchEventsList, reviewEvent } from '@/lib/api';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function QAPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<AgGridReact>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchEventsList(1, 1000).then(data => {
      setEvents(data.events || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [colDefs] = useState<any[]>([
    { field: 'name', headerName: 'Event Name', checkboxSelection: true, flex: 2 },
    { field: 'sport', headerName: 'Sport', flex: 1 },
    { field: 'venue_name', headerName: 'Venue', flex: 1 },
    { field: 'start_date', headerName: 'Start Date', flex: 1 },
    { field: 'extraction_method', headerName: 'Method', flex: 1 },
    { field: 'review_status', headerName: 'Review Status', flex: 1 },
  ]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  const handleReview = async (status: string) => {
    const selectedNodes = gridRef.current?.api.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) return;
    
    const promises = selectedNodes.map(node => 
      reviewEvent(node.data.id, status)
    );
    
    await Promise.all(promises);
    loadData(); // refresh data
  };

  return (
    <div className="p-8 h-full overflow-y-auto flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Data QA</h1>
          <p className="text-muted-foreground mt-1">Review extracted events before they are published.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => handleReview('rejected')}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20 px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            Reject Selected
          </button>
          <button 
            onClick={() => handleReview('approved')}
            className="bg-green-500/10 text-green-500 hover:bg-green-500/20 px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            Approve Selected
          </button>
        </div>
      </div>
      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden ag-theme-quartz-dark">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">Loading events...</div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={events}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            pagination={true}
            paginationPageSize={50}
          />
        )}
      </div>
    </div>
  );
}
