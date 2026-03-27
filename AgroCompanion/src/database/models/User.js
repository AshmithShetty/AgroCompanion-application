import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export class User extends Model {
  static table = 'users';

  @text('username') username;
}
