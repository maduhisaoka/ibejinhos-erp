type IconProps = {
  size?: number;
  className?: string;
  fill?: string;
};

function Svg({
  size = 20,
  className,
  fill = "none",
  children
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Heart = (props: IconProps) => <Svg {...props}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" /></Svg>;
export const ShoppingBag = (props: IconProps) => <Svg {...props}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></Svg>;
export const ArrowRight = (props: IconProps) => <Svg {...props}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Svg>;
export const Gift = (props: IconProps) => <Svg {...props}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13" /><path d="M3 12h18" /><path d="M7.5 8A2.5 2.5 0 1 1 12 5.5V8" /><path d="M16.5 8A2.5 2.5 0 1 0 12 5.5V8" /></Svg>;
export const Bike = (props: IconProps) => <Svg {...props}><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6h3l-3 7H8l3-7" /><path d="m8 13-2.5 4.5" /><path d="M12 13 9 8" /></Svg>;
export const MapPin = (props: IconProps) => <Svg {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>;
export const Plus = (props: IconProps) => <Svg {...props}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
export const Minus = (props: IconProps) => <Svg {...props}><path d="M5 12h14" /></Svg>;
export const Trash2 = (props: IconProps) => <Svg {...props}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6 18 20H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></Svg>;
export const Send = (props: IconProps) => <Svg {...props}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>;
export const Lock = (props: IconProps) => <Svg {...props}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
export const Eye = (props: IconProps) => <Svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const EyeOff = (props: IconProps) => <Svg {...props}><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a17.2 17.2 0 0 1-3.2 4.5" /><path d="M6.6 6.6C3.8 8.5 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 4.8-1.3" /></Svg>;
export const Save = (props: IconProps) => <Svg {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></Svg>;
