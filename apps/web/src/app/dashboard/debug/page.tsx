'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuthStore } from '@/stores/auth-store';
import { Play, Copy, Check, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiEndpoint {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  category: string;
  requiresAuth: boolean;
  hasBody: boolean;
  bodyTemplate?: string;
  pathParams?: string[];
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // Auth endpoints
  {
    id: 'auth-login',
    name: 'Login',
    method: 'POST',
    path: '/api/auth/login',
    description: 'Authenticate user and get access token',
    category: 'Auth',
    requiresAuth: false,
    hasBody: true,
    bodyTemplate: JSON.stringify({ username: 'admin', password: 'password' }, null, 2),
  },
  // Task endpoints
  {
    id: 'tasks-list',
    name: 'List Tasks',
    method: 'GET',
    path: '/api/tasks',
    description: 'Get all tasks',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: false,
  },
  {
    id: 'tasks-create',
    name: 'Create Task',
    method: 'POST',
    path: '/api/tasks',
    description: 'Create a new task',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify(
      {
        name: 'Test Task',
        prompt: 'What is the current time?',
        cronSchedule: '0 9 * * *',
        isActive: true,
        timezone: 'Asia/Shanghai',
      },
      null,
      2
    ),
  },
  {
    id: 'tasks-update',
    name: 'Update Task',
    method: 'PUT',
    path: '/api/tasks/:id',
    description: 'Update an existing task',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: true,
    pathParams: ['id'],
    bodyTemplate: JSON.stringify(
      {
        name: 'Updated Task',
        isActive: false,
      },
      null,
      2
    ),
  },
  {
    id: 'tasks-delete',
    name: 'Delete Task',
    method: 'DELETE',
    path: '/api/tasks/:id',
    description: 'Delete a task',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: false,
    pathParams: ['id'],
  },
  {
    id: 'tasks-run',
    name: 'Run Task',
    method: 'POST',
    path: '/api/tasks/:id/run',
    description: 'Execute a task immediately',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: false,
    pathParams: ['id'],
  },
  {
    id: 'tasks-executions',
    name: 'Get Executions',
    method: 'GET',
    path: '/api/tasks/executions',
    description: 'Get task execution history',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: false,
  },
  {
    id: 'tasks-task-executions',
    name: 'Get Task Executions',
    method: 'GET',
    path: '/api/tasks/:id/executions',
    description: 'Get execution history for a specific task',
    category: 'Tasks',
    requiresAuth: true,
    hasBody: false,
    pathParams: ['id'],
  },
  // Agent endpoints
  {
    id: 'agent-run',
    name: 'Run Agent',
    method: 'POST',
    path: '/api/agent/run',
    description: 'Execute agent with a task prompt',
    category: 'Agent',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify({ task: 'What is 2 + 2?' }, null, 2),
  },
  // Feishu endpoints
  {
    id: 'feishu-status',
    name: 'Get Status',
    method: 'GET',
    path: '/api/feishu/status',
    description: 'Check Feishu webhook configuration status',
    category: 'Feishu',
    requiresAuth: true,
    hasBody: false,
  },
  {
    id: 'feishu-send-text',
    name: 'Send Text',
    method: 'POST',
    path: '/api/feishu/send-text',
    description: 'Send a text message to Feishu',
    category: 'Feishu',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify({ text: 'Hello from Improbix!' }, null, 2),
  },
  {
    id: 'feishu-send-message',
    name: 'Send Message',
    method: 'POST',
    path: '/api/feishu/send-message',
    description: 'Send a formatted message to Feishu (text, post, interactive)',
    category: 'Feishu',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify(
      {
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title: 'Test Message',
              content: [
                [
                  { tag: 'text', text: 'This is a ' },
                  { tag: 'a', text: 'link', href: 'https://example.com' },
                ],
              ],
            },
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: 'feishu-test-connection',
    name: 'Test Connection',
    method: 'POST',
    path: '/api/feishu/test-connection',
    description: 'Send a test message to verify Feishu connection',
    category: 'Feishu',
    requiresAuth: true,
    hasBody: false,
  },
  // Search endpoints
  {
    id: 'search-status',
    name: 'Get Status',
    method: 'GET',
    path: '/api/search/status',
    description: 'Check Firecrawl API configuration status',
    category: 'Search',
    requiresAuth: true,
    hasBody: false,
  },
  {
    id: 'search-query',
    name: 'Search (GET)',
    method: 'GET',
    path: '/api/search/query?q=:query',
    description: 'Search the internet using query parameter',
    category: 'Search',
    requiresAuth: true,
    hasBody: false,
    pathParams: ['query'],
  },
  {
    id: 'search-post',
    name: 'Search (POST)',
    method: 'POST',
    path: '/api/search/search',
    description: 'Search the internet using POST body',
    category: 'Search',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify({ query: 'latest tech news' }, null, 2),
  },
  {
    id: 'search-scrape',
    name: 'Scrape URL',
    method: 'POST',
    path: '/api/search/scrape',
    description: 'Scrape content from a specific URL',
    category: 'Search',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify({ url: 'https://example.com' }, null, 2),
  },
  {
    id: 'search-crawl',
    name: 'Crawl URL',
    method: 'POST',
    path: '/api/search/crawl',
    description: 'Crawl multiple pages from a URL',
    category: 'Search',
    requiresAuth: true,
    hasBody: true,
    bodyTemplate: JSON.stringify({ url: 'https://example.com', limit: 5 }, null, 2),
  },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-green-500/10 text-green-500 border-green-500/20',
  POST: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PUT: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function DebugPage() {
  const { token, isAuthenticated } = useAuthStore();
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [requestBody, setRequestBody] = useState('');
  const [pathParamValues, setPathParamValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    data: unknown;
    duration: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEndpointSelect = useCallback((endpointId: string) => {
    const endpoint = API_ENDPOINTS.find((e) => e.id === endpointId);
    if (endpoint) {
      setSelectedEndpoint(endpoint);
      setRequestBody(endpoint.bodyTemplate || '');
      setPathParamValues({});
      setResponse(null);
      setError(null);
    }
  }, []);

  const buildUrl = useCallback(() => {
    if (!selectedEndpoint) return '';
    let url = selectedEndpoint.path;
    selectedEndpoint.pathParams?.forEach((param) => {
      url = url.replace(`:${param}`, pathParamValues[param] || `:${param}`);
    });
    return url;
  }, [selectedEndpoint, pathParamValues]);

  const executeRequest = useCallback(async () => {
    if (!selectedEndpoint) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    const startTime = performance.now();

    try {
      const url = buildUrl();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (selectedEndpoint.requiresAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers,
      };

      if (selectedEndpoint.hasBody && requestBody) {
        try {
          JSON.parse(requestBody);
          options.body = requestBody;
        } catch {
          setError('Invalid JSON in request body');
          setIsLoading(false);
          return;
        }
      }

      const res = await fetch(url, options);
      const duration = performance.now() - startTime;

      let data: unknown;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        duration,
      });

      if (!res.ok) {
        toast.error(`Request failed with status ${res.status}`);
      } else {
        toast.success(`Request completed in ${duration.toFixed(0)}ms`);
      }
    } catch (err) {
      const duration = performance.now() - startTime;
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResponse({
        status: 0,
        statusText: 'Network Error',
        data: null,
        duration,
      });
      toast.error('Request failed');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEndpoint, requestBody, token, buildUrl]);

  const copyResponse = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      toast.success('Response copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [response]);

  const formatJson = useCallback((data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, []);

  const categories = Array.from(new Set(API_ENDPOINTS.map((e) => e.category)));

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Debug Console</h1>
        <p className="text-muted-foreground mt-1">
          Test and debug all API endpoints directly from the browser
        </p>
      </div>

      {!isAuthenticated && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Authenticated</AlertTitle>
          <AlertDescription>
            You are not logged in. Some endpoints require authentication. Use the Login endpoint
            first to get an access token.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
            <CardDescription>Select an endpoint and configure your request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Endpoint Selector */}
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Select onValueChange={handleEndpointSelect} value={selectedEndpoint?.id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an endpoint..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {API_ENDPOINTS.filter((e) => e.category === category).map((endpoint) => (
                        <SelectItem key={endpoint.id} value={endpoint.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={METHOD_COLORS[endpoint.method]}>
                              {endpoint.method}
                            </Badge>
                            <span>{endpoint.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEndpoint && (
              <>
                <Separator />

                {/* Endpoint Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={METHOD_COLORS[selectedEndpoint.method]}>
                      {selectedEndpoint.method}
                    </Badge>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{buildUrl()}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedEndpoint.description}</p>
                  <div className="flex gap-2">
                    {selectedEndpoint.requiresAuth && (
                      <Badge variant="secondary">Requires Auth</Badge>
                    )}
                    {selectedEndpoint.hasBody && <Badge variant="secondary">Has Body</Badge>}
                  </div>
                </div>

                {/* Path Parameters */}
                {selectedEndpoint.pathParams && selectedEndpoint.pathParams.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Path Parameters</Label>
                      {selectedEndpoint.pathParams.map((param) => (
                        <div key={param} className="flex items-center gap-2">
                          <Label className="w-20 text-muted-foreground">{param}:</Label>
                          <Input
                            placeholder={`Enter ${param}`}
                            value={pathParamValues[param] || ''}
                            onChange={(e) =>
                              setPathParamValues((prev) => ({
                                ...prev,
                                [param]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Request Body */}
                {selectedEndpoint.hasBody && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Request Body (JSON)</Label>
                      <Textarea
                        className="font-mono text-sm min-h-[200px]"
                        placeholder="Enter JSON request body..."
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Execute Button */}
                <Button
                  onClick={executeRequest}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Execute Request
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Response</span>
              {response && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      response.status >= 200 && response.status < 300
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }
                  >
                    {response.status} {response.statusText}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {response.duration.toFixed(0)}ms
                  </Badge>
                  <Button size="icon" variant="ghost" onClick={copyResponse}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </CardTitle>
            <CardDescription>View the API response here</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {response ? (
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px] text-sm font-mono whitespace-pre-wrap break-all">
                {formatJson(response.data)}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                {selectedEndpoint
                  ? 'Execute a request to see the response'
                  : 'Select an endpoint to get started'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>API Reference</CardTitle>
          <CardDescription>Quick overview of all available endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {API_ENDPOINTS.map((endpoint) => (
              <div
                key={endpoint.id}
                className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleEndpointSelect(endpoint.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={METHOD_COLORS[endpoint.method]}>
                    {endpoint.method}
                  </Badge>
                  <span className="font-medium">{endpoint.name}</span>
                </div>
                <code className="text-xs text-muted-foreground">{endpoint.path}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
