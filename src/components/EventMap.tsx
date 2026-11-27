'use client';

import { useEffect, useRef } from 'react';
import type { Circle, LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Point = { lat: number; lng: number };

type Props =
  | { mode: 'pick'; value: Point | null; onPick: (p: Point) => void; label: string }
  | { mode: 'view'; exact: Point | null; approx: Point | null; label: string };

const DEFAULT_CENTER: Point = { lat: -23.55, lng: -46.63 }; // São Paulo
const APPROX_RADIUS_M = 900;

/**
 * Mapa OpenStreetMap (Leaflet). Em modo "view", mostra o ponto exato só quando
 * ele foi liberado; caso contrário, apenas um círculo da região aproximada.
 */
export function EventMap(props: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const onPickRef = useRef<((p: Point) => void) | null>(null);
  onPickRef.current = props.mode === 'pick' ? props.onPick : null;

  const pickValue = props.mode === 'pick' ? props.value : null;
  const exact = props.mode === 'view' ? props.exact : null;
  const approx = props.mode === 'view' ? props.approx : null;

  // Cria o mapa uma vez
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !holder.current || map.current) return;
      const start = pickValue ?? exact ?? approx ?? DEFAULT_CENTER;
      const m = L.map(holder.current, {
        center: [start.lat, start.lng],
        zoom: pickValue || exact ? 15 : approx ? 13 : 11,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      if (props.mode === 'pick') {
        m.on('click', (e: LeafletMouseEvent) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      }
      map.current = m;
      draw(L);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza marcador/círculo quando os dados mudam
  useEffect(() => {
    (async () => {
      if (!map.current) return;
      const L = await import('leaflet');
      draw(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickValue?.lat, pickValue?.lng, exact?.lat, exact?.lng, approx?.lat, approx?.lng]);

  function draw(L: typeof import('leaflet')) {
    const m = map.current;
    if (!m) return;
    marker.current?.remove();
    circle.current?.remove();
    marker.current = null;
    circle.current = null;

    const icon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34] });
    const point = pickValue ?? exact;
    if (point) {
      marker.current = L.marker([point.lat, point.lng], { icon, keyboard: false }).addTo(m);
      if (props.mode === 'pick') m.panTo([point.lat, point.lng]);
    } else if (approx) {
      circle.current = L.circle([approx.lat, approx.lng], {
        radius: APPROX_RADIUS_M,
        color: '#0a4c8c',
        weight: 2,
        fillOpacity: 0.12,
      }).addTo(m);
    }
  }

  return (
    <div className="event-map">
      <div ref={holder} className="event-map__canvas" role="region" aria-label={props.label} />
    </div>
  );
}
