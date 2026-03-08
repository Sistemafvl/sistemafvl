import logo from "@/assets/logo.png";

interface LogoHeaderProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 sm:h-10",
  md: "h-12 sm:h-16",
  lg: "h-16 sm:h-24",
  xl: "h-20 sm:h-32",
};

const LogoHeader = ({ size = "md" }: LogoHeaderProps) => {
  return (
    <div className="flex items-center justify-center select-none">
      <img
        src={logo}
        alt="Sistema FVL"
        className={`${sizeClasses[size]} w-auto object-contain`}
        draggable={false}
      />
    </div>
  );
};

export default LogoHeader;
