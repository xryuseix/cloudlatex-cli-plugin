import { FileWatcher } from './../../src/fileService/fileWatcher';
import * as Sinon from 'sinon';
import * as chai from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import { TypeDB } from '@moritanian/type-db';
import { FILE_INFO_DESC } from '../../src/model/fileModel';
import { Logger } from '../../src/util/logger';
import * as tool from './../tool/syncTestTool';

const fixturePath = path.resolve(__dirname, './../fixture').replace(/\\/g, path.posix.sep);
const workspacePath = path.resolve(__dirname, './../workspace').replace(/\\/g, path.posix.sep);

const setupWorkspace = async () => {
  await cleanupWorkspace();
  await fs.copy(fixturePath, workspacePath);
  await tool.sleep(1000);
};

const cleanupWorkspace = async () => {
  await fs.emptyDir(workspacePath);
};

let watcher: FileWatcher | null;

const setupInstances = async () => {
  const db = new TypeDB();
  const files = db.getRepository(FILE_INFO_DESC);
  files.new({ relativePath: 'main.tex', watcherSynced: true });
  watcher = new FileWatcher(workspacePath, files, () => true, new Logger('warn'));
  const changedSpy = Sinon.spy();
  const awaitChangeDetection = () => {
    return new Promise((resolve) => {
      watcher?.on('change-detected', resolve);
    });
  };
  watcher.on('change-detected', changedSpy);
  await watcher.init();
  return {
    files,
    watcher,
    changedSpy,
    awaitChangeDetection
  };
};

before(setupWorkspace);
after(cleanupWorkspace);

afterEach(() => {
  if (watcher) {
    watcher.stop();
    watcher = null;
  }
});

describe('Create', () => {
  it('localChange should be "create"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'new_file.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.createFile(filePath);
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'create');
    await fs.remove(filePath);
  });
});

describe('Update', () => {
  it('localChange should be "update"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'main.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.writeFile(filePath, 'updated content');
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'update');
  });
});

describe('Delete', () => {
  it('localChange should be "delete"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'main.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.remove(filePath);
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'delete');
    fs.createFile(filePath);
    // await awaitChangeDetection();
  });
});


describe('Create and Update', () => {
  it('localChange should be "create"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'new_file.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.createFile(filePath);
    await awaitChangeDetection();
    fs.writeFile(filePath, 'updated content');
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'create');
    await fs.remove(filePath);
  });
});

describe('Create and Update and Delete', () => {
  it('the file should not exist', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'new_file.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.createFile(filePath);
    await awaitChangeDetection();
    fs.writeFile(filePath, 'updated content');
    await awaitChangeDetection();
    fs.remove(filePath);
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.isNull(file);
  });
});

describe('Delete and recreate', () => {
  it('localChange should be "update"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'main.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.remove(filePath);
    await awaitChangeDetection();
    fs.createFile(filePath);
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'update');
  });
});


describe('Update, delete and recreate', () => {
  it('localChange should be "update"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'main.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.writeFile(filePath, 'update content');
    await awaitChangeDetection();
    fs.remove(filePath);
    await awaitChangeDetection();
    fs.createFile(filePath);
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'update');
  });
});

describe('Create, delete and recreate', () => {
  it('localChange should be "create"', async () => {
    const { files, awaitChangeDetection } = await setupInstances();
    const relativePath = 'new_file.tex';
    const filePath = path.resolve(workspacePath, relativePath);
    fs.createFile(filePath);
    await awaitChangeDetection();
    fs.remove(filePath);
    await awaitChangeDetection();
    fs.createFile(filePath);
    await awaitChangeDetection();
    const file = files.findBy('relativePath', relativePath);
    chai.assert.strictEqual(file && file.localChange, 'create');
  });
});
