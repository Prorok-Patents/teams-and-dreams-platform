'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Source, Layer, MapRef, NavigationControl } from 'react-map-gl/mapbox';
import type { CircleLayer, SymbolLayer, MapLayerMouseEvent, GeoJSONSource } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export interface MapEvent {
  id: string;
  name: string;
  sport: string;
  level: string;
  status: string;
  start_date: string;
  end_date: string;
  venue_name: string;
  city: string;
  country: string;
  source_url: string;
}

interface MapComponentProps {
  filters?: {
    sport?: string;
    level?: string;
    dateStart?: string;
    dateEnd?: string;
  };
  onEventsLoaded?: (events: MapEvent[]) => void;
  onSelectEvent?: (event: MapEvent) => void;
  selectedEventId?: string | null;
}

const clusterLayer: CircleLayer = {
  id: 'clusters',
  type: 'circle',
  source: 'events',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 50, '#f28cb1'],
    'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40]
  }
};

const clusterCountLayer: SymbolLayer = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'events',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12
  }
};

const unclusteredPointLayer: CircleLayer = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'events',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#11b4da',
    'circle-radius': 8,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff'
  }
};

export default function MapComponent({ filters, onEventsLoaded, onSelectEvent }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{feature: GeoJSON.Feature, x: number, y: number} | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    try {
      const { data: geojson, error } = await supabase.rpc('get_events_in_bbox', {
        min_lon: bounds.getWest(),
        min_lat: bounds.getSouth(),
        max_lon: bounds.getEast(),
        max_lat: bounds.getNorth(),
        sport_filter: filters?.sport || null,
        level_filter: filters?.level || null,
        date_start: filters?.dateStart ? `${filters.dateStart}T00:00:00` : null,
        date_end: filters?.dateEnd ? `${filters.dateEnd}T23:59:59` : null,
      });

      if (error) {
        console.error('Supabase RPC error fetching events:', error);
        return;
      }

      if (geojson) {
        setData(geojson);

        if (onEventsLoaded && geojson.features) {
          const events: MapEvent[] = geojson.features
            .filter((f: GeoJSON.Feature) => !f.properties?.point_count)
            .map((f: GeoJSON.Feature) => ({
              id: f.properties?.event_id || f.properties?.id || (f.id as string) || '',
              name: f.properties?.name || '',
              sport: f.properties?.sport || '',
              level: f.properties?.level || '',
              status: f.properties?.status || '',
              start_date: f.properties?.start_date || '',
              end_date: f.properties?.end_date || '',
              venue_name: f.properties?.venue_name || '',
              city: f.properties?.city || '',
              country: f.properties?.country || '',
              source_url: f.properties?.source_url || '',
            }));
          onEventsLoaded(events);
        }
      }
    } catch (err) {
      console.error('Failed to fetch events', err);
    }
  }, [filters, onEventsLoaded]);

  useEffect(() => {
    if (mapRef.current) {
      fetchEvents();
    }
  }, [filters, fetchEvents]);

  const onMapLoad = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onMapIdle = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onHover = useCallback((event: MapLayerMouseEvent) => {
    const {
      features,
      point: { x, y }
    } = event;
    const hoveredFeature = features && features[0];

    if (hoveredFeature && hoveredFeature.layer?.id === 'unclustered-point') {
      setHoverInfo({ feature: hoveredFeature, x, y });
    } else {
      setHoverInfo(null);
    }
  }, []);

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0];
    if (!feature) return;

    if (feature.layer?.id === 'unclustered-point' && onSelectEvent) {
      onSelectEvent({
        id: feature.properties?.event_id || feature.properties?.id || '',
        name: feature.properties?.name || '',
        sport: feature.properties?.sport || '',
        level: feature.properties?.level || '',
        status: feature.properties?.status || '',
        start_date: feature.properties?.start_date || '',
        end_date: feature.properties?.end_date || '',
        venue_name: feature.properties?.venue_name || '',
        city: feature.properties?.city || '',
        country: feature.properties?.country || '',
        source_url: feature.properties?.source_url || '',
      });
      setHoverInfo(null);
    }

    // Zoom into clusters on click
    if (feature.layer?.id === 'clusters') {
      const clusterId = feature.properties?.cluster_id;
      const source = mapRef.current?.getSource('events') as GeoJSONSource;
      if (source && clusterId != null) {
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (!err && feature.geometry.type === 'Point') {
            mapRef.current?.easeTo({
              center: feature.geometry.coordinates as [number, number],
              zoom: zoom || 14,
              duration: 500,
            });
          }
        });
      }
    }
  }, [onSelectEvent]);

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: 40,
          longitude: -10,
          zoom: 2
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={['unclustered-point', 'clusters']}
        onMouseMove={onHover}
        onClick={onClick}
        onLoad={onMapLoad}
        onIdle={onMapIdle}
        cursor={hoverInfo ? 'pointer' : ''}
      >
        <NavigationControl position="top-right" />
        
        {data && (
          <Source
            id="events"
            type="geojson"
            data={data}
            cluster={true}
            clusterMaxZoom={14}
            clusterRadius={50}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredPointLayer} />
          </Source>
        )}

        {hoverInfo && (
          <div
            className="map-tooltip"
            style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}
          >
            <h3 className="map-tooltip-title">{hoverInfo.feature.properties?.name || 'Event'}</h3>
            <p className="map-tooltip-location">
              {hoverInfo.feature.properties?.venue_name || 'Venue'} — {hoverInfo.feature.properties?.city || ''}, {hoverInfo.feature.properties?.country || ''}
            </p>
            <div className="map-tooltip-meta">
              <span className="map-tooltip-sport">{hoverInfo.feature.properties?.sport || 'Sport'}</span>
              <span>
                {hoverInfo.feature.properties?.start_date 
                  ? new Date(hoverInfo.feature.properties.start_date).toLocaleDateString()
                  : ''}
              </span>
            </div>
          </div>
        )}
      </Map>
    </div>
  );
}
