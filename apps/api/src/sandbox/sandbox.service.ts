import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sandbox } from '@e2b/code-interpreter';

const MAX_OUTPUT_LENGTH = 10240;
const DEFAULT_TIMEOUT = 30;

function truncate(str: string, max = MAX_OUTPUT_LENGTH): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n...[truncated, ${str.length - max} chars omitted]`;
}

@Injectable()
export class SandboxService implements OnModuleDestroy {
  private readonly logger = new Logger(SandboxService.name);
  private sandbox: Sandbox | null = null;
  private apiKey: string | null = null;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('E2B_API_KEY') || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async getOrCreateSandbox(): Promise<Sandbox> {
    if (!this.apiKey) {
      throw new Error('E2B_API_KEY is not configured');
    }
    if (!this.sandbox) {
      this.logger.log('Creating new E2B sandbox...');
      this.sandbox = await Sandbox.create({ apiKey: this.apiKey });
      this.logger.log(`Sandbox created: ${this.sandbox.sandboxId}`);
    }
    return this.sandbox;
  }

  async executeCode(
    language: 'python' | 'javascript',
    code: string,
  ): Promise<{ stdout: string; stderr: string; results: unknown[]; error: string | null }> {
    const sandbox = await this.getOrCreateSandbox();
    try {
      const execution = await sandbox.runCode(code, {
        language,
        timeoutMs: DEFAULT_TIMEOUT * 1000,
      } as any);

      const stdout = execution.logs.stdout.map((m: any) => m.line ?? m).join('\n');
      const stderr = execution.logs.stderr.map((m: any) => m.line ?? m).join('\n');
      const results = execution.results.map((r: any) => ({
        text: r.text,
        ...(r.png ? { png: `data:image/png;base64,${r.png}` } : {}),
      }));
      const error = execution.error
        ? `${execution.error.name}: ${execution.error.value}\n${execution.error.traceback}`
        : null;

      return {
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        results,
        error,
      };
    } catch (err: any) {
      this.logger.error(`Code execution failed: ${err.message}`);
      // Sandbox may be dead, reset it
      this.sandbox = null;
      return { stdout: '', stderr: '', results: [], error: err.message };
    }
  }

  async executeShell(
    command: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sandbox = await this.getOrCreateSandbox();
    try {
      const result = await sandbox.commands.run(command, {
        timeoutMs: DEFAULT_TIMEOUT * 1000,
      });
      return {
        stdout: truncate(result.stdout),
        stderr: truncate(result.stderr),
        exitCode: result.exitCode,
      };
    } catch (err: any) {
      this.logger.error(`Shell execution failed: ${err.message}`);
      this.sandbox = null;
      return { stdout: '', stderr: err.message, exitCode: 1 };
    }
  }

  async onModuleDestroy() {
    if (this.sandbox) {
      this.logger.log('Killing sandbox on shutdown...');
      try {
        await this.sandbox.kill();
      } catch {
        // ignore
      }
      this.sandbox = null;
    }
  }
}
