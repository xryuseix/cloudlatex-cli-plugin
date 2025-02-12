/* eslint-disable @typescript-eslint/naming-convention */
import { IBackend } from '../../src/backend/ibackend';
import { ProjectInfo, KeyType } from '../../src/types';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC, FileInfo } from '../../src/model/fileModel';
import { v4 as uuid } from 'uuid';
import { ReadableString, streamToString } from '../../src/util/stream';

/*
 * BackendMock Class
 *
 * [Warn]
 *  file.id in remoteFiles is not equal to file.id in local files.
 */
export class BackendStub implements IBackend {
  public isOffline = false;
  public remoteContents: Record<string, string> = {};
  public remoteFiles: Repository<typeof FILE_INFO_DESC>;
  constructor() {
    const remotedb = new TypeDB();
    this.remoteFiles = remotedb.getRepository(FILE_INFO_DESC);
  }

  validateToken(): Promise<boolean> {
    return Promise.resolve(true);
  }

  loadProjectInfo(): Promise<ProjectInfo> {
    if (this.isOffline) {
      return Promise.reject();
    }
    return Promise.resolve({
      id: 1,
      compile_target_file_id: 1,
      title: '',
    });
  }

  loadFileList(): Promise<FileInfo[]> {
    if (this.isOffline) {
      return Promise.reject();
    }
    return Promise.resolve(this.remoteFiles.all());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: unknown): Promise<{
    remoteId: string;
    remoteRevision: string;
  }> {
    if (this.isOffline) {
      return Promise.reject();
    }
    const newFile = this.remoteFiles.new({ ...file });
    newFile.id = -1; // reset local id
    const remoteId = newFile.remoteId = uuid();
    const remoteRevision = newFile.remoteRevision = uuid();
    this.remoteContents[remoteId] = await streamToString(stream);
    return {
      remoteId,
      remoteRevision
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  async createRemote(file: FileInfo, parent: FileInfo | null): Promise<{ remoteId: KeyType, remoteRevision: any }> {
    if (this.isOffline) {
      return Promise.reject('offline');
    }
    const newFile = this.remoteFiles.new({ ...file });
    newFile.id = -1; // reset local id
    const remoteId = newFile.remoteId = uuid();
    const remoteRevision = newFile.remoteRevision = uuid();
    return {
      remoteId,
      remoteRevision
    };
  }

  async download(file: FileInfo): Promise<NodeJS.ReadableStream> {
    if (this.isOffline) {
      return Promise.reject();
    }
    const remoteFile = this.remoteFiles.findBy('remoteId', file.remoteId);
    if (!remoteFile) {
      throw new Error('remoteFile is null');
    }

    if (remoteFile.remoteId === null) {
      throw new Error('remoteId is null');
    }
    if (!(remoteFile.remoteId in this.remoteContents)) {
      throw new Error('remote content is not found');
    }
    return new ReadableString(this.remoteContents[remoteFile.remoteId]);
  }

  async updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType> {
    if (this.isOffline) {
      return Promise.reject();
    }
    const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
    if (!targetFile || !targetFile.remoteId) {
      throw new Error('No update target file or no remote id');
    }
    this.remoteContents[targetFile.remoteId] = await streamToString(stream);
    return targetFile.remoteRevision = uuid();
  }

  deleteRemote(file: FileInfo): Promise<void> {
    if (this.isOffline) {
      return Promise.reject();
    }
    const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
    if (!targetFile) {
      throw new Error('No delete target file');
    }
    this.remoteFiles.delete(targetFile.id);
    delete this.remoteContents[targetFile.id];
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compileProject(): Promise<any> {
    if (this.isOffline) {
      return Promise.reject();
    }
    return Promise.resolve();
  }

  /*
   * File operation methods for test situations
   */
  async _createInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void> {
    const isOffline = this.isOffline;
    this.isOffline = false;
    await this.upload(fileInfo as FileInfo, new ReadableString(content));
    this.isOffline = isOffline;
  }

  async _updateInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void> {
    const isOffline = this.isOffline;
    this.isOffline = false;

    const remoteFiles = this.remoteFiles.where(fileInfo);
    if (!remoteFiles || remoteFiles.length !== 1) {
      throw new Error('Remote file is not found');
    }
    await this.updateRemote(remoteFiles[0], new ReadableString(content));

    this.isOffline = isOffline;
  }

  _deleteInRemote(fileInfo: Partial<FileInfo>): Promise<void> {
    const isOffline = this.isOffline;

    this.isOffline = false;
    const remoteFiles = this.remoteFiles.where(fileInfo);
    if (!remoteFiles || remoteFiles.length !== 1) {
      throw new Error('Remote file is not found');
    }
    this.deleteRemote(remoteFiles[0]);

    this.isOffline = isOffline;
    return Promise.resolve();
  }
}
