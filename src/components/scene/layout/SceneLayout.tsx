import { PointsLayout } from './PointsLayout';
import { type LayoutProps, useWide } from './shared';
import { SheetLayout } from './SheetLayout';

/** The scene's controls: a strip of point cards on phones, a floating list of points on tablets and up. */
export function SceneLayout(props: LayoutProps) {
  return useWide() ? <SheetLayout {...props} /> : <PointsLayout {...props} />;
}
