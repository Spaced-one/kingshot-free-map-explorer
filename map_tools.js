import {objectFootprint} from './logic.js';
import {t} from './i18n.js';

export function validMapPoint(point){return !!point&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&point.x>=0&&point.y>=0&&point.x<1200&&point.y<1200;}
export function mapDistance(a,b){if(!validMapPoint(a)||!validMapPoint(b))return null;const dx=b.x-a.x,dy=b.y-a.y;return {dx,dy,cases:Math.hypot(dx,dy)};}
export function mapZone(a,b){if(!validMapPoint(a)||!validMapPoint(b))return null;const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);return {minX,maxX,minY,maxY,width:maxX-minX+1,height:maxY-minY+1};}
export function overlapsZone(row,zone){if(!zone)return false;const f=objectFootprint(row);return f.x<=zone.maxX&&f.y<=zone.maxY&&f.x+f.width>zone.minX&&f.y+f.height>zone.minY;}
export function snapshotAge(stamp,now=Date.now()){
  const time=typeof stamp==='string'&&stamp.trim()?Date.parse(stamp):NaN;
  if(!Number.isFinite(time)||!Number.isFinite(now))return t('snapshot_age.unknown');
  if(time>now)return t('snapshot_age.future');
  const minutes=Math.floor((now-time)/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
  const value=minutes===0?t('snapshot_age.less_than_minute'):days?t('snapshot_age.days_ago',{days,hours:hours%24}):hours?t('snapshot_age.hours_ago',{hours,minutes:minutes%60}):t('snapshot_age.minutes_ago',{minutes});
  return t('snapshot_age.prefix',{value});
}
