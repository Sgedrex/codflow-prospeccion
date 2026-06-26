"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Lead } from "@/types/lead";
import { getTierStyle } from "@/lib/tier-colors";

const PANAMA_CITY_CENTER: [number, number] = [9.0, -79.5];

interface LeadsMapInnerProps {
  leads: Lead[];
  focusLead?: Lead | null;
}

// Vuela hacia el lead enfocado cuando cambia
function FlyTo({ lead }: { lead?: Lead | null }) {
  const map = useMap();
  useEffect(() => {
    if (lead && typeof lead.latitud === "number" && typeof lead.longitud === "number") {
      map.flyTo([lead.latitud, lead.longitud], 16, { duration: 0.8 });
    }
  }, [lead, map]);
  return null;
}

export default function LeadsMapInner({ leads, focusLead }: LeadsMapInnerProps) {
  return (
    <MapContainer
      center={PANAMA_CITY_CENTER}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo lead={focusLead} />
      {leads.map((lead) => {
        if (typeof lead.latitud !== "number" || typeof lead.longitud !== "number") {
          return null;
        }
        const style = getTierStyle(lead.tier ?? lead.pre_tier);
        const esFoco = focusLead?.id === lead.id;
        return (
          <CircleMarker
            key={lead.id}
            center={[lead.latitud, lead.longitud]}
            radius={esFoco ? 12 : 7}
            pathOptions={{
              color: esFoco ? "#2563eb" : style.mapColor,
              fillColor: style.mapColor,
              fillOpacity: esFoco ? 1 : 0.85,
              weight: esFoco ? 4 : 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{lead.nombre}</p>
                <p className="text-xs text-gray-500">{lead.rubro}</p>
                <p className="mt-1 text-xs">
                  {style.label}
                  {typeof (lead.puntaje_total ?? lead.pre_score) === "number" &&
                    ` · ${Math.round((lead.puntaje_total ?? lead.pre_score) as number)} pts`}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
