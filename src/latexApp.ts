import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import Logger, { getErrorTraceStr } from './util/logger';
import { wildcard2regexp } from './util/pathUtil';
import { Config, DecideSyncMode, Account, CompileResult, AppInfo, LoginStatus } from './types';
import FileAdapter from './fileService/fileAdapter';
import SyncManager, { SyncResult } from './fileService/syncManager';
import FileWatcher from './fileService/fileWatcher';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC } from './model/fileModel';
import Backend from './backend/ibackend';
import backendSelector from './backend/backendSelector';
import AccountService from './service/accountService';
import AppInfoService from './service/appInfoService';

type NoPayloadEvents = 'sync-failed' | 'file-changed';
class LAEventEmitter extends EventEmitter<''> {
}
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
interface LAEventEmitter {
  emit(eventName: NoPayloadEvents): boolean;
  on(eventName: NoPayloadEvents, callback: () => unknown): this;
  emit(eventName: 'login-status-updated', arg: LoginStatus): void;
  on(eventName: 'login-status-updated', callback: (arg: LoginStatus) => unknown): void;
  emit(eventName: 'project-loaded', arg: AppInfo): void;
  on(eventName: 'project-loaded', callback: (arg: AppInfo) => unknown): void;
  emit(eventName: 'successfully-synced', arg: SyncResult): void;
  on(eventName: 'successfully-synced', callback: (arg: SyncResult) => unknown): void;
}
/* eslint-enable @typescript-eslint/adjacent-overload-signatures */


const IGNORE_FILES = [
  '*.aux',
  '*.bbl',
  '*.blg',
  '*.idx',
  '*.ind',
  '*.lof',
  '*.lot',
  '*.out',
  '*.toc',
  '*.acn',
  '*.acr',
  '*.alg',
  '*.glg',
  '*.glo',
  '*.gls',
  '*.fls',
  '*.log',
  '*.fdb_latexmk',
  '*.snm',
  '*.synctex',
  '*.synctex(busy)',
  '*.synctex.gz(busy)',
  '*.nav'
];


export default class LatexApp extends LAEventEmitter {
  private syncManager: SyncManager;
  private fileWatcher: FileWatcher;

  /**
   * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
   */
  constructor(
    private config: Config,
    private accountService: AccountService<Account>,
    private appInfoService: AppInfoService,
    private backend: Backend,
    private fileAdapter: FileAdapter,
    private fileRepo: Repository<typeof FILE_INFO_DESC>,
    decideSyncMode: DecideSyncMode,
    private logger: Logger = new Logger()) {
    super();

    /**
     * Sync Manager
     */
    this.syncManager = new SyncManager(fileRepo, fileAdapter,
      async (conflictFiles) => {
        appInfoService.setConflicts(conflictFiles);
        return decideSyncMode(conflictFiles);
      }
      , logger);

    this.syncManager.on('sync-finished', (result) => {
      if (result.success) {
        this.emit('successfully-synced', result);
      } else if (result.canceled) {
        // canceled
      } else {
        this.logger.error('Error in syncSession: ' + result.errors.join('\n'));
        this.emit('sync-failed');
      }
    });

    /**
     * File watcher
     */
    this.fileWatcher = new FileWatcher(this.config.rootPath, fileRepo,
      relativePath => {
        const outFilePaths = [
          this.config.outDir,
          appInfoService.appInfo.logPath,
          appInfoService.appInfo.pdfPath,
          appInfoService.appInfo.synctexPath
        ];

        return !outFilePaths.includes(relativePath) &&
          !IGNORE_FILES.some(
            ignoreFile => relativePath.match(wildcard2regexp(ignoreFile))
          );
      },
      logger);

    this.fileWatcher.on('change-detected', async () => {
      this.emit('file-changed');
    });
  }

  get appInfo(): AppInfo {
    return this.appInfoService.appInfo;
  }

  /**
   * setup file management classes
   *
   * Instantiate fileAdapter, fileWatcher and syncManager.
   * The fileWatcher detects local changes.
   * The syncManager synchronize local files with remote ones.
   * The file Adapter abstructs file operations of local files and remote ones.
   */
  static async createApp(config: Config, option: {
    decideSyncMode?: DecideSyncMode,
    logger?: Logger,
    accountService?: AccountService<Account>
  } = {}): Promise<LatexApp> {

    const logger = option.logger || new Logger();
    logger.log(`latex-cli ${'1.0.0'}`);

    // Config
    config = this.sanitizeConfig(config);

    // Account
    const accountService = option.accountService || new AccountService();
    await accountService.load();

    // AppInfo
    const appInfoService = new AppInfoService(config);

    // Backend
    const backend = backendSelector(config, accountService);

    // DB
    const dbFilePath = config.storagePath ? path.join(
      config.storagePath, `.${config.projectId}-${config.backend}.json`
    ) : undefined;
    const db = new TypeDB(dbFilePath);
    try {
      await db.load();
    } catch (err) {
      // Not initialized because there is no db file.
    }
    const fileRepo = db.getRepository(FILE_INFO_DESC);
    fileRepo.all().forEach(file => {
      file.watcherSynced = true;
    });
    fileRepo.save();

    const fileAdapter = new FileAdapter(config.rootPath, fileRepo, backend);
    const defaultDecideSyncMode: DecideSyncMode = () => Promise.resolve('upload');
    const decideSyncMode: DecideSyncMode = option.decideSyncMode || defaultDecideSyncMode;
    return new LatexApp(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger);
  }

  private static sanitizeConfig(config: Config): Config {
    const outDir = config.outDir || config.rootPath;
    let relativeOutDir = path.isAbsolute(outDir) ?
      path.relative(config.rootPath, outDir) :
      path.join(outDir);
    relativeOutDir = relativeOutDir.replace(/\\/g, path.posix.sep); // for windows
    const rootPath = config.rootPath.replace(/\\/g, path.posix.sep); // for windows
    if (relativeOutDir === path.posix.sep || relativeOutDir === `.${path.posix.sep}`) {
      relativeOutDir = '';
    }
    return { ...config, outDir: relativeOutDir, rootPath };
  }

  /**
   * Start to watch file system
   */
  public startFileWatcher(): Promise<void> {
    return this.fileWatcher.init();
  }


  /**
   * Stop watching file system
   */
  public stopFileWatcher(): Promise<void> {
    return this.fileWatcher.stop();
  }

  private onValid() {
    if (this.appInfoService.appInfo.loginStatus === 'valid') {
      return;
    }
    this.appInfoService.setLoginStatus('valid');
    this.logger.info('Your account has been validated!');
    this.emit('login-status-updated', this.appInfoService.appInfo.loginStatus);
  }

  private onInvalid() {
    if (this.appInfoService.appInfo.loginStatus === 'invalid') {
      return;
    }
    this.appInfoService.setLoginStatus('invalid');
    this.emit('login-status-updated', this.appInfoService.appInfo.loginStatus);
  }

  private onOffline() {
    if (this.appInfoService.appInfo.loginStatus === 'offline') {
      return;
    }
    this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
    this.appInfoService.setLoginStatus('offline');
    this.emit('login-status-updated', this.appInfoService.appInfo.loginStatus);
  }

  /**
   * Compile and save pdf, synctex and log files.
   */
  public async compile(): Promise<CompileResult> {
    this.logger.log('Start compiling');
    try {
      if (!this.appInfoService.appInfo.loaded) {
        const projectInfo = await this.backend.loadProjectInfo();
        const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
        if (!file) {
          this.logger.error('Target file is not found');
          return { status: 'no-target-error' };
        }
        const targetName = path.posix.basename(file.relativePath, '.tex');
        this.appInfoService.setProjectName(projectInfo.title);
        this.appInfoService.setTarget(projectInfo.compile_target_file_id, targetName);
        this.appInfoService.setLoaded();
        this.emit('project-loaded', this.appInfo);
      }

      const result = await this.backend.compileProject();

      if (result.status !== 'success') {
        return result;
      }

      const promises = [];

      // download log file
      if (result.logStream) {
        if (this.appInfoService.appInfo.logPath) {
          promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath, result.logStream).catch(err => {
            this.logger.error('Some error occurred with saving a log file. ' + getErrorTraceStr(err));
          }));
        } else {
          this.logger.error('Log file path is not set');
        }
      }

      // download pdf
      if (result.pdfStream) {
        if (this.appInfoService.appInfo.pdfPath) {
          promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath, result.pdfStream).catch(err => {
            this.logger.error('Some error occurred with downloading the compiled pdf file. ' + getErrorTraceStr(err));
          }));
        } else {
          this.logger.error('PDF file path is not set');
        }
      }

      // download synctex
      if (result.synctexStream) {
        if (this.appInfoService.appInfo.synctexPath) {
          promises.push(
            this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath, result.synctexStream).catch(err => {
              this.logger.error('Some error occurred with saving a synctex file. ' + getErrorTraceStr(err));
            })
          );
        } else {
          this.logger.error('Synctex file path is not set');
        }
      }

      // wait to download all files
      await Promise.all(promises);

      this.logger.log('Sucessfully compiled');
      return result;
    } catch (err) {
      this.logger.warn('Some error occured with compilation.' + getErrorTraceStr(err));
      return { status: 'unknown-error' };
    }
  }

  /**
   * Validate account
   *
   * @return Promise<'valid' | 'invalid' | 'offline'>
   */
  public async validateAccount(): Promise<'valid' | 'invalid' | 'offline'> {
    try {
      const result = await this.backend.validateToken();
      if (!result) {
        this.onInvalid();
        return 'invalid';
      }
    } catch (err) {
      this.onOffline();
      return 'offline';
    }
    this.onValid();
    return 'valid';
  }

  /**
   * Set account
   *
   * @param account Account
   */
  public setAccount(account: Account): void {
    this.accountService.save(account);
  }

  /**
   * Start to synchronize files with the remote server
   */
  public async startSync(): Promise<void> {
    await this.syncManager.syncSession();
  }

  /**
   * clear local changes to resolve sync problem
   */
  public resetLocal(): void {
    this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
  }
}
