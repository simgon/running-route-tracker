import React, { useEffect, useRef } from "react";

interface CurrentLocationMarkerProps {
  position: { lat: number; lng: number };
  heading?: number; // 方向（度）
  map: google.maps.Map;
}

const CurrentLocationMarker: React.FC<CurrentLocationMarkerProps> = ({
  position,
  heading = 0,
  map,
}) => {
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    // SVGアイコンを作成（青い丸と方向を示す扇形）
    const createLocationIcon = (heading: number) => {
      console.log("CurrentLocationMarker: heading =", heading);

      const size = 120; // SVGサイズを拡大
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = 10;

      // 方向を示す扇形のパス（60度の角度）
      const fanAngle = 60; // 度
      const fanLength = 50; // 扇形の長さを短縮
      const startAngle = heading - fanAngle / 2;
      const endAngle = heading + fanAngle / 2;

      console.log("扇形角度:", { heading, startAngle, endAngle });

      const startX = centerX + Math.cos((startAngle * Math.PI) / 180) * fanLength;
      const startY = centerY + Math.sin((startAngle * Math.PI) / 180) * fanLength;
      const endX = centerX + Math.cos((endAngle * Math.PI) / 180) * fanLength;
      const endY = centerY + Math.sin((endAngle * Math.PI) / 180) * fanLength;

      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            ${heading !== 0 ? `<!-- 方向を示す扇形 -->
            <path d="M ${centerX} ${centerY} L ${startX} ${startY} A ${fanLength} ${fanLength} 0 0 1 ${endX} ${endY} Z" 
                  fill="rgba(25, 118, 210, 0.3)" stroke="none"/>` : ''}
            <!-- 青い丸 -->
            <circle cx="${centerX}" cy="${centerY}" r="${radius}" 
                    fill="#1976d2" stroke="white" stroke-width="3"/>
            <!-- 影効果 -->
            <circle cx="${centerX}" cy="${centerY}" r="${radius + 3}" 
                    fill="none" stroke="rgba(25, 118, 210, 0.2)" stroke-width="2"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(centerX, centerY),
      };
    };

    // マーカーを作成
    const marker = new google.maps.Marker({
      position: { lat: position.lat, lng: position.lng },
      map: map,
      icon: createLocationIcon(heading),
      zIndex: 1000,
    });

    markerRef.current = marker;

    // マーカーを永続表示（トラッキング停止時に手動で削除）
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [position, heading, map]);

  return null;
};

export default CurrentLocationMarker;
