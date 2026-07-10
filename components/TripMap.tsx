'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Fix } from '@/lib/db';
import { SEGMENTS } from '@/lib/route';

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

function trailGeojson(fixes: Fix[]): GeoJSON.FeatureCollection {
  // Two-point line features so each hop carries its own over-limit flag.
  const features: GeoJSON.Feature[] = [];
  for (let i = 1; i < fixes.length; i++) {
    features.push({
      type: 'Feature',
      properties: { over: fixes[i].over },
      geometry: {
        type: 'LineString',
        coordinates: [
          [fixes[i - 1].lng, fixes[i - 1].lat],
          [fixes[i].lng, fixes[i].lat],
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function fitTrail(map: maplibregl.Map, fixes: Fix[]) {
  if (fixes.length < 2) return;
  const lngs = fixes.map((f) => f.lng);
  const lats = fixes.map((f) => f.lat);
  map.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 40, duration: 500, maxZoom: 15 }
  );
}

export default function TripMap({ fixes, follow }: { fixes: Fix[]; follow?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const fixesRef = useRef(fixes);
  fixesRef.current = fixes;
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    if (!el.current || mapRef.current) return; // ref-guard: never re-init, never remove()
    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [73.52, 4.2],
      zoom: 11.6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    (window as any).__map = map; // dev handle
    map.on('style.load', () => {
      map.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: SEGMENTS.map((s) => ({
            type: 'Feature',
            properties: { name: s.name },
            geometry: { type: 'LineString', coordinates: s.coords },
          })),
        },
      });
      map.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: { 'line-color': '#5a6478', 'line-width': 2, 'line-dasharray': [2, 2] },
      });
      map.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'trail',
        type: 'line',
        source: 'trail',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': ['case', ['get', 'over'], '#e5484d', '#f0b429'],
          'line-width': 4,
        },
      });
      readyRef.current = true;
      // fixes may have arrived before the style finished loading (replay page)
      (map.getSource('trail') as maplibregl.GeoJSONSource).setData(trailGeojson(fixesRef.current));
      if (!followRef.current) fitTrail(map, fixesRef.current);
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource('trail') as maplibregl.GeoJSONSource | undefined)?.setData(trailGeojson(fixes));
    const last = fixes[fixes.length - 1];
    if (follow && last) {
      map.easeTo({ center: [last.lng, last.lat], zoom: 14.5, duration: 900 });
    } else if (!follow) {
      fitTrail(map, fixes);
    }
  }, [fixes, follow]);

  return <div ref={el} className="map" />;
}
