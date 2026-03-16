import { useListFrameworks } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function FrameworkList() {
  const { data: frameworks, isLoading } = useListFrameworks();

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Frameworks</h1>
          <p className="text-muted-foreground mt-1">Map internal controls to standard regulatory requirements.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
        ) : frameworks?.data?.length === 0 ? (
          <div className="text-center p-12 bg-card border rounded-xl shadow-sm text-muted-foreground">
            No frameworks loaded in the system.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {frameworks?.data?.map((fw) => (
              <Card key={fw.id} className="hover:shadow-md transition-shadow flex flex-col overflow-hidden group">
                <div className="h-2 w-full bg-sidebar group-hover:bg-primary transition-colors" />
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center">
                    {fw.name}
                    <ShieldCheck className="h-5 w-5 text-muted-foreground/50" />
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-mono pt-1">Version: {fw.version}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <p className="text-sm text-foreground/80 line-clamp-2 my-4">
                    {fw.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t">
                    <span className="text-xs text-muted-foreground">Added {format(new Date(fw.createdAt || ''), 'MMM yyyy')}</span>
                    <Link href={`/compliance/${fw.id}`}>
                      <Button variant="ghost" size="sm" className="group-hover:bg-secondary">
                        Analyze Gaps <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
