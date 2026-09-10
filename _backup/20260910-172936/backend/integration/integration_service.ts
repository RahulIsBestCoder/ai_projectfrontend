import { IntegrationModel } from '../models/integration_model';
import { IServiceResult } from '../../../helper/common_interface';
import { IIntegrationCreate, IIntegrationUpdate } from '../interface/integration_interface';

/**
 * `IntegrationService` – Business logic for integration CRUD and settings.
 */
export class IntegrationService {
  private readonly _integrationModel = new IntegrationModel();
  private readonly logName = 'integration_service';

  private initLog(): void {
    /* parity with plan convention */
  }

  private log(method: string, msg: unknown, severity = 'INFO'): void {
    global.logs.writelog(`${this.logName}.${method}`, msg, severity);
  }

  /*
   * @Developer: Sougata Bauri
   * @Date: 2026-08-31
   * @Function: createIntegration
   */
  public async createIntegration(param: IIntegrationCreate): Promise<IServiceResult> {
    this.initLog();
    this.log('createIntegration', ['Request : ', param]);
    try {
      const existing = await this._integrationModel.findByAny({ provider: param.provider, repository_name: param.repository_name });
      if (existing) {
        return global.Helpers.makeBadServiceStatus('Integration already exists.');
      }
      const newInt = await this._integrationModel.addNewRecord(param);
      this.log('Add new integration result:', newInt);
      return global.Helpers.makeSuccessServiceStatus('Integration created.', newInt);
    } catch (err: any) {
      this.log('createIntegration', err?.stack || err, 'ERROR');
      return global.Helpers.makeBadServiceStatus('Something went wrong, please try again later.');
    }
  }

  /*
   * @Developer: Sougata Bauri
   * @Date: 2026-08-31
   * @Function: getIntegration
   */
  public async getIntegration(id: string): Promise<IServiceResult> {
    this.initLog();
    this.log('getIntegration', ['Request : ', id]);
    try {
      const int = await this._integrationModel.findByAny({ _id: id });
      if (!int) {
        return global.Helpers.makeBadServiceStatus('Integration not found.');
      }
      return global.Helpers.makeSuccessServiceStatus('Integration fetched.', int);
    } catch (err: any) {
      this.log('getIntegration', err?.stack || err, 'ERROR');
      return global.Helpers.makeBadServiceStatus('Something went wrong, please try again later.');
    }
  }

  /*
   * @Developer: Sougata Bauri
   * @Date: 2026-08-31
   * @Function: updateIntegration
   */
  public async updateIntegration(id: string, param: IIntegrationUpdate): Promise<IServiceResult> {
    this.initLog();
    this.log('updateIntegration', ['Request : ', { id, param }]);
    try {
      const updated = await this._integrationModel.updateAnyRecord({ _id: id }, param);
      this.log('Update integration result:', updated);
      return global.Helpers.makeSuccessServiceStatus('Integration updated.', updated);
    } catch (err: any) {
      this.log('updateIntegration', err?.stack || err, 'ERROR');
      return global.Helpers.makeBadServiceStatus('Something went wrong, please try again later.');
    }
  }

  /*
   * @Developer: Sougata Bauri
   * @Date: 2026-08-31
   * @Function: deleteIntegration
   */
  public async deleteIntegration(id: string): Promise<IServiceResult> {
    this.initLog();
    this.log('deleteIntegration', ['Request : ', id]);
    try {
      const deleted = await this._integrationModel.updateAnyRecord({ _id: id }, { is_deleted: true });
      this.log('Delete integration result:', deleted);
      return global.Helpers.makeSuccessServiceStatus('Integration deleted.', deleted);
    } catch (err: any) {
      this.log('deleteIntegration', err?.stack || err, 'ERROR');
      return global.Helpers.makeBadServiceStatus('Something went wrong, please try again later.');
    }
  }

  public async getByProject(projectId: string): Promise<IServiceResult> {
    this.initLog();
    this.log('getByProject', ['Request : ', projectId]);
    try {
      const integrations = await this._integrationModel.findAllByAny({ project_id: projectId, is_deleted: false });
      return global.Helpers.makeSuccessServiceStatus('Integrations fetched.', {
        rows: integrations,
        count: integrations.length,
      });
    } catch (err: any) {
      this.log('getByProject', err?.stack || err, 'ERROR');
      return global.Helpers.makeBadServiceStatus('Something went wrong, please try again later.');
    }
  }

  /*
   * @Developer: Sougata Bauri
   * @Date: 2026-09-10
   * @Function: getSyncHistory
   * @Description: Paginated sync-run history for one integration, with a
   *               success/failure roll-up and the last-sync timestamp.
   */
  public async getSyncHistory(integrationId: string, page: number = 1, limit: number = 20): Promise<IServiceResult> {
    this.initLog();
    this.log('getSyncHistory', ['Request : ', { integrationId, page, limit }]);
    try {
      const integration = await this._integrationModel.findByAny({ _id: integrationId });
      if (!integration) {
        return global.Helpers.makeBadServiceStatus('Integration not found.');
      }

      const db = global.db.connection.db!;
      const filter = { integration_id: integrationId };
      const offset = (page - 1) * limit;
      const rows = await db.collection('sync_history')
        .find(filter)
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();
      const total = await db.collection('sync_history').countDocuments(filter);

      const stats = await db.collection('sync_history').aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            items: { $sum: { $ifNull: ['$items_synced', 0] } },
            avg_duration_ms: { $avg: { $ifNull: ['$duration_ms', 0] } },
            last_run: { $max: '$created_at' },
          },
        },
      ]).toArray();

      const byStatus: Record<string, number> = {};
      for (const s of stats) {
        byStatus[String(s._id)] = s.count;
      }
      const success = stats.find((s: any) => s._id === 'success');
      const failed = stats.find((s: any) => s._id === 'failed' || s._id === 'error');
      const partial = stats.find((s: any) => s._id === 'partial');
      const round1 = (n: number) => Math.round(n * 10) / 10;

      return global.Helpers.makeSuccessServiceStatus('Sync history fetched.', {
        rows,
        count: rows.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        stats: {
          total_runs: total,
          by_status: byStatus,
          success_runs: success ? success.count : 0,
          partial_runs: partial ? partial.count : 0,
          failed_runs: failed ? failed.count : 0,
          total_items_synced: (success ? success.items : 0) + (failed ? failed.items : 0) + (partial ? partial.items : 0),
          avg_duration_ms: round1(stats.length ? stats.reduce((a: number, s: any) => a + s.avg_duration_ms * s.count, 0) / (total || 1) : 0),
          last_sync_at: success && success.last_run ? success.last_run : (failed && failed.last_run ? failed.last_run : null),
        },
      });
    } catch (err: any) {
      this.log('getSyncHistory', err?.stack || err, 'ERROR');
      return global.Helpers.makeBadServiceStatus('Something went wrong, please try again later.');
    }
  }
}
