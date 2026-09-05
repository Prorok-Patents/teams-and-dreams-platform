'use client';
import React, { useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ClientSideRowModelModule, ModuleRegistry } from 'ag-grid-community';

// Register ag-grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

export default function VerifyPanel({ nodeId }: { nodeId: string }) {
  const [rowData, setRowData] = useState([
    { id: 1, name: 'Winter Championship 2026', sport: 'Snowboarding', date: '2026-12-15', status: 'pending' },
    { id: 2, name: 'National Ski Finals', sport: 'Skiing', date: '2026-02-10', status: 'pending' },
    { id: 3, name: 'Spring Board Festival', sport: 'Snowboarding', date: '2027-03-01', status: 'pending' },
  ]);

  const [colDefs] = useState([
    { field: 'name', headerName: 'Event Name', flex: 2 },
    { field: 'sport', headerName: 'Sport', flex: 1 },
    { field: 'date', headerName: 'Date', flex: 1 },
    { 
      field: 'status', 
      headerName: 'Action', 
      flex: 1,
      cellRenderer: (params: any) => {
        return (
          <div className="flex gap-1 items-center h-full">
            <button 
              className="bg-green-600 hover:bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase"
              onClick={() => {
                const newData = [...rowData];
                const index = newData.findIndex(r => r.id === params.data.id);
                if (index >= 0) {
                  newData[index].status = 'approved';
                  setRowData(newData);
                }
              }}
            >
              Approve
            </button>
            <button 
              className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase"
              onClick={() => {
                const newData = [...rowData];
                const index = newData.findIndex(r => r.id === params.data.id);
                if (index >= 0) {
                  newData[index].status = 'rejected';
                  setRowData(newData);
                }
              }}
            >
              Reject
            </button>
          </div>
        );
      }
    }
  ]);

  const defaultColDef = useMemo(() => {
    return {
      resizable: true,
      sortable: true,
      filter: true,
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 border-b border-[#333]">
        <h3 className="text-white font-bold text-xs uppercase tracking-wider">Scraped Data Verification</h3>
        <p className="text-white/50 text-xs mt-1">Review and approve extracted events before they enter the knowledge graph.</p>
      </div>
      <div className="flex-1 w-full relative">
        <div className="absolute inset-0 ag-theme-alpine-dark">
          <AgGridReact
            rowData={rowData.filter(r => r.status === 'pending')}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressCellFocus={true}
          />
        </div>
      </div>
    </div>
  );
}
