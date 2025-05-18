import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { ConnectError } from '@connectrpc/connect';
import {
  lucideMoreVertical,
  lucidePencil,
  lucideTrash2,
} from '@ng-icons/lucide';
import { BrnMenuModule } from '@spartan-ng/ui-menu-brain';
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { injectTaskService } from '@tierklinik-dobersberg/angular/connect';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmMenuModule } from '@tierklinik-dobersberg/angular/menu';
import { DisplayNamePipe, ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import {
  Board,
  TaskComment,
  TaskTimelineEntry,
} from '@tierklinik-dobersberg/apis/tasks/v1';
import { MarkdownModule } from 'ngx-markdown';
import { toast } from 'ngx-sonner';
import { MyEditor } from 'src/app/ckeditor';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { UserColorVarsDirective } from 'src/app/components/user-color-vars';

@Component({
  selector: 'app-task-comment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-comment.html',
  imports: [
    AppAvatarComponent,
    MarkdownModule,
    ToDatePipe,
    DatePipe,
    HlmTooltipModule,
    BrnTooltipModule,
    UserColorVarsDirective,
    HlmMenuModule,
    BrnMenuModule,
    HlmIconModule,
    HlmButtonDirective,
    CKEditorModule,
    FormsModule,
  ],
  providers: [
    ...provideIcons({
      lucideMoreVertical,
      lucideTrash2,
      lucidePencil,
    }),
  ],
})
export class TaskCommentComponent {
  public readonly entry = input.required<TaskTimelineEntry>();
  public readonly comment = input.required<TaskComment>();
  public readonly board = input.required<Board>();

  private readonly taskService = injectTaskService();

  protected readonly editMode = signal(false);
  protected readonly commentText = signal('');
  protected readonly profiles = injectUserProfiles();

  protected readonly editor = class extends MyEditor {
    public static builtinPlugins = [
        ...MyEditor.builtinPlugins,
        MentionCustomization,
    ]
  }

  constructor() {
    effect(
      () => {
        const comment = this.comment();
        this.commentText.set(comment.comment);
      },
      { allowSignalWrites: true }
    );
  }

  protected readonly config: any = computed(() => {
    const profiles = this.profiles();

    return {
      mention: {
        feeds: [
          {
            marker: '@',
            feed: (queryText: string) => {
              queryText = queryText.toLowerCase();

              return new Promise((resolve, reject) => {
                const users = profiles
                  .filter(profile => {
                    return (
                      profile.user.username.toLowerCase().includes(queryText) ||
                      profile.user.firstName
                        ?.toLowerCase()
                        .includes(queryText) ||
                      profile.user.displayName
                        ?.toLowerCase()
                        .includes(queryText)
                    );
                  })
                  .map(profile => ({
                    id: '@' + profile.user.username,
                    userId: profile.user.id,
                    text: new DisplayNamePipe().transform(profile),
                  }));

                resolve(users);
              });
            },
          },
          {
            marker: '#',
            feed: (queryText: string) => {
                return this.taskService
                    .listTasks({
                        queries: [
                            {
                                boardId: [this.board().id],
                            }
                        ]
                    })
                    .then(response => {
                        return response.tasks
                            .filter(task => {
                                return task.title.toLocaleLowerCase().includes(queryText.toLocaleLowerCase())
                            })
                            .map(task => {
                                return {
                                    id: '#' + task.title,
                                    taskId: task.id,
                                    name: task.title,
                                    text: task.title
                                }
                            })
                    })
            }
          }
        ],
      },
    };
  });

  protected toggleEdit() {
    const edit = this.editMode();

    if (edit) {
      this.taskService
        .updateTaskComment({
          timelineId: this.entry().id,
          kind: {
            case: 'newText',
            value: this.commentText(),
          },
        })
        .catch(err => {
          toast.error('Kommentar konnte nicht gespeichert werden', {
            description: ConnectError.from(err).message,
          });
        });
    }

    this.editMode.set(!edit);
  }
}

function MentionCustomization( editor ) {
    // The upcast converter will convert <a>
    // elements to the model 'mention' attribute.
    editor.conversion.for( 'upcast' ).elementToAttribute( {
        view: {
            name: 'a',
            attributes: {
                href: /(task|user):.*/,
            }
        },
        model: {
            key: 'mention',
            value: viewItem => {
                const href = viewItem.getAttribute("href");

                const task = /task:(.*)/.exec(href)
                const user = /user:(.*)/.exec(href)

                // The mention feature expects that the mention attribute value
                // in the model is a plain object with a set of additional attributes.
                // In order to create a proper object, use the toMentionAttribute helper method:
                const mentionAttribute = editor.plugins.get( 'Mention' ).toMentionAttribute( viewItem, {
                    // Add any other properties that you need.
                    link: href,
                    taskId: task ? task[1] : undefined,
                    userId: user ? user[1] : undefined,
                } );

                return mentionAttribute;
            }
        },
        converterPriority: 'high'
    } );

    // Downcast the model 'mention' text attribute to a view <a> element.
    editor.conversion.for( 'downcast' ).attributeToElement( {
        model: 'mention',
        view: ( modelAttributeValue, { writer } ) => {
            // Do not convert empty attributes (lack of value means no mention).
            if ( !modelAttributeValue ) {
                return;
            }

            const taskId = modelAttributeValue.taskId;
            const userId = modelAttributeValue.userId;

            const attr = {
                class: 'mention',
            }

            if (taskId) {
                attr['href'] = 'task:' + taskId
                attr['data-task-id'] = taskId
            }

            if (userId) {
                attr['href'] = 'user:' + userId
                attr['data-user-id'] = userId
            }

            return writer.createAttributeElement( 'a', attr, {
                // Make mention attribute to be wrapped by other attribute elements.
                priority: 20,
                // Prevent merging mentions together.
                id: modelAttributeValue.uid
            } );
        },
        converterPriority: 'high'
    } );
}