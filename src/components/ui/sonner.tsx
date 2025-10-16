import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Detect theme from document class or default to light
  const getTheme = (): "light" | "dark" | "system" => {
    if (typeof document !== "undefined") {
      if (document.documentElement.classList.contains("dark")) {
        return "dark";
      }
      if (document.documentElement.classList.contains("light")) {
        return "light";
      }
    }
    return "system";
  };

  return (
    <Sonner
      theme={getTheme()}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
