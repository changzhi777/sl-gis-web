/**
 * 经纬度坐标转墨卡托坐标（照抄 smartcity math.js）
 * @param longitude 经度（角度值）
 * @param latitude  纬度（角度值）
 * @returns {{x,y}} 墨卡托坐标，单位米，x∈[-20037508.34,20037508.34]
 */
export function lon2xy(longitude: number, latitude: number): { x: number; y: number } {
  const E = longitude;
  const N = latitude;
  const x = (E * 20037508.34) / 180;
  let y = (Math.log(Math.tan(((90 + N) * Math.PI) / 360)) / (Math.PI / 180));
  y = (y * 20037508.34) / 180;
  return { x, y };
}