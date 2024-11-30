// utils/colorUtils.ts

export const interpolateColor = (
    startColor: { r: number; g: number; b: number },
    endColor: { r: number; g: number; b: number },
    factor: number
  ): string => {
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * factor);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * factor);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  };

interface ColorStop {
    min: number;
    max: number;
    startColor: { r: number; g: number; b: number };
    endColor: { r: number; g: number; b: number };
  }
  
  const colorStops: ColorStop[] = [
    {
      min: 0.5,
      max: 0.6,
      startColor: { r: 255, g: 0, b: 0 },     // Red
      endColor: { r: 255, g: 0, b: 0 },       // Red (no change)
    },
    {
      min: 0.6,
      max: 0.7,
      startColor: { r: 255, g: 0, b: 0 },     // Red
      endColor: { r: 255, g: 165, b: 0 },     // Orange
    },
    {
      min: 0.7,
      max: 0.8,
      startColor: { r: 255, g: 165, b: 0 },   // Orange
      endColor: { r: 255, g: 255, b: 0 },     // Yellow
    },
    {
      min: 0.8,
      max: 0.9,
      startColor: { r: 255, g: 255, b: 0 },   // Yellow
      endColor: { r: 173, g: 255, b: 47 },    // Yellow-Green
    },
    {
      min: 0.9,
      max: 1.0,
      startColor: { r: 173, g: 255, b: 47 },  // Yellow-Green
      endColor: { r: 0, g: 128, b: 0 },        // Green
    },
  ];
  
  export const getGradientColor = (score: number): string => {
    for (const stop of colorStops) {
      if (score >= stop.min && score <= stop.max) {
        const factor = (score - stop.min) / (stop.max - stop.min);
        return interpolateColor(stop.startColor, stop.endColor, factor);
      }
    }
    // Default color if score is out of range
    return 'gray';
  };
  