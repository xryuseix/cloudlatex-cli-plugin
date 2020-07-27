import fetch from 'node-fetch';
import { CompileResult } from './types';
import * as FormData from 'form-data';
import { Config, ProjectInfo, Account } from '../../types';
import AccountManager from '../../accountManager';

export default class CLWebAppApi {
  private APIRoot: string;
  private APIProjects: string;
  constructor(private config: Config, private accountManager: AccountManager<Account>) {
    this.APIRoot = config.endpoint;
    this.APIProjects = config.endpoint + '/projects';
  }

  private headers(option: {json?: boolean, form?: boolean} = {}) {
    if (!this.accountManager.account) {
      throw new Error('account is not defined');
    }
    const headers: any = {
      'uid': this.accountManager.account.email,
      'access-token': this.accountManager.account.token,
      'client': this.accountManager.account.client,
      // 'accept-language': 'ja,en-US;q=0.9,en;q=0.8'
    };
    if (option.json) {
      headers['Content-Type'] = 'application/json';
    }
    if (option.form) {
      headers['Content-Type'] = 'multipart/form-data';
    }
    return headers;
  }

  async validateToken() {
    const res = await fetch(`${this.APIRoot}/auth/validate_token`, { headers: this.headers() });
    if (!res.ok) {
      return false;
    }
    const json = await res.json();
    return !!json['success'];
  }

  async loadProjects() {
    const res = await fetch(this.APIProjects, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.json());
  }

  async loadProjectInfo() {
    const res = await fetch(`${this.APIProjects}/${this.config.projectId}`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    const text = await res.text();
    return JSON.parse(text)['project'] as ProjectInfo;
  }

  async loadFiles() {
    const res = await fetch(`${this.APIProjects}/${this.config.projectId}/files`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async createFile(name: string, belonging_to: number | null, is_folder: boolean) {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files`,
      { headers: this.headers({ json: true }),
      method: 'POST',
      body: JSON.stringify({ name, is_folder, belonging_to }) }
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async deleteFile(id: number) {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files/${id}`,
      { headers: this.headers(),
      method: 'DELETE' }
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async updateFile(id: number, params: any): Promise<{revision: string}> {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files/${id}`,
      { headers: this.headers({ json: true }),
      body: JSON.stringify({ material_file: params }),
      method: 'PUT' }
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async compileProject(): Promise<CompileResult> {
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/compile`,
      { headers: this.headers(),
      method: 'POST' }
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async uploadFile(stream: NodeJS.ReadableStream, relativeDir: string) {
    const form = new FormData();
    form.append('relative_path', relativeDir);
    form.append('file', stream);
    const headers = form.getHeaders();
    const res = await fetch(
      `${this.APIProjects}/${this.config.projectId}/files/upload`,
      { headers: { ...this.headers(), ...headers },
      body: form,
      method: 'POST' }
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return JSON.parse(await res.text());
  }

  async download(url: string): Promise<NodeJS.ReadableStream> {
    const res = await fetch(
      `${url}`
    );
    if (!res.ok) {
      throw new Error(JSON.stringify(res));
    }
    return res.body;
  }

  async loadSynctexObject(url: string) {
    const res = await fetch(
      `${url}`
    );
    return await res.arrayBuffer();
  }
};
