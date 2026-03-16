import { AppLayout } from "@/components/layout/app-layout";
import { useGetMe, useListLlmProviders, useGetAgentConfig, useListUsers, useUpdateUserRole } from "@workspace/api-client-react";
import type { UpdateUserRoleBodyRole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Bot, Server, Loader2, Users, Shield } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const ROLES: { value: UpdateUserRoleBodyRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "risk_manager", label: "Risk Manager" },
  { value: "risk_owner", label: "Risk Owner" },
  { value: "auditor", label: "Auditor" },
  { value: "viewer", label: "Viewer" },
  { value: "vendor", label: "Vendor" },
];

export default function Settings() {
  const { data: user } = useGetMe();
  const { data: providers, isLoading: providersLoading } = useListLlmProviders();
  const { data: agentConfig, isLoading: agentLoading } = useGetAgentConfig();
  const { data: usersList, isLoading: usersLoading } = useListUsers({ query: { queryKey: ["/api/v1/users"], retry: false } });
  const queryClient = useQueryClient();

  const roleUpdateMutation = useUpdateUserRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      },
    },
  });

  if (user?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="p-12 text-center h-full flex flex-col justify-center items-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">You do not have the required permissions to view tenant settings. Only administrators can access this page.</p>
          <Link href="/dashboard"><Button variant="outline" className="mt-6">Return to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const users = Array.isArray(usersList) ? usersList : [];

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Settings</h1>
          <p className="text-muted-foreground mt-1">Manage configuration for {user.tenantId.split('-')[0]}</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
            <TabsTrigger value="users" className="data-[state=active]:shadow-sm rounded-md">
              <Users className="h-4 w-4 mr-2" /> Users & Roles
            </TabsTrigger>
            <TabsTrigger value="agent" className="data-[state=active]:shadow-sm rounded-md">
              <Bot className="h-4 w-4 mr-2" /> Agent Config
            </TabsTrigger>
            <TabsTrigger value="llm" className="data-[state=active]:shadow-sm rounded-md">
              <Server className="h-4 w-4 mr-2" /> LLM Providers
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="users" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Users className="h-5 w-5 mr-2"/> User Management</CardTitle>
                  <CardDescription>View and manage user accounts and role assignments.</CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No users found for this tenant.</div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map(u => (
                          <TableRow key={u.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold border">
                                  {u.email.charAt(0).toUpperCase()}
                                </div>
                                {u.email}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {u.name || '-'}
                            </TableCell>
                            <TableCell>
                              {u.id === user.id ? (
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="capitalize text-sm font-mono">{u.role.replace('_', ' ')}</span>
                                  <span className="text-[10px] text-muted-foreground">(you)</span>
                                </div>
                              ) : (
                                <Select
                                  value={u.role}
                                  onValueChange={(newRole) => {
                                    roleUpdateMutation.mutate({ id: u.id, data: { role: newRole as UpdateUserRoleBodyRole } });
                                  }}
                                >
                                  <SelectTrigger className="w-[160px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLES.map(r => (
                                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agent" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Bot className="h-5 w-5 mr-2"/> Autonomous Agent</CardTitle>
                  <CardDescription>Configuration for the Risk Intelligence Agent.</CardDescription>
                </CardHeader>
                <CardContent>
                  {agentLoading ? <Loader2 className="animate-spin" /> : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b">
                        <div>
                          <div className="font-medium">Agent Status</div>
                          <div className="text-sm text-muted-foreground">Master toggle for automated runs</div>
                        </div>
                        <div className="font-mono text-sm bg-secondary px-3 py-1 rounded">{agentConfig?.enabled ? 'Enabled' : 'Disabled'}</div>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <div>
                          <div className="font-medium">Policy Tier</div>
                          <div className="text-sm text-muted-foreground">Defines execution autonomy</div>
                        </div>
                        <div className="font-mono text-sm capitalize bg-secondary px-3 py-1 rounded">{agentConfig?.policyTier}</div>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <div>
                          <div className="font-medium">Schedule (Cron)</div>
                          <div className="text-sm text-muted-foreground">When the agent wakes up</div>
                        </div>
                        <div className="font-mono text-sm bg-secondary px-3 py-1 rounded">{agentConfig?.schedule}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="llm" className="m-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Server className="h-5 w-5 mr-2"/> LLM Providers</CardTitle>
                  <CardDescription>Configured language models for AI features.</CardDescription>
                </CardHeader>
                <CardContent>
                  {providersLoading ? <Loader2 className="animate-spin" /> : (
                    <div className="space-y-4">
                      {providers?.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {p.name}
                              {p.isDefault && <span className="text-[10px] uppercase font-bold tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Default</span>}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-1">{p.model} &bull; {p.providerType}</div>
                          </div>
                          <div className="text-sm font-medium text-emerald-600">Active</div>
                        </div>
                      ))}
                      {providers?.length === 0 && <div className="text-sm text-muted-foreground">No providers configured.</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
