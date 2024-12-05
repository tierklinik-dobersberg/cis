/**
 * @license Copyright (c) 2014-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import { Autoformat, BlockQuote, Bold, ClassicEditor, Heading, Image, ImageStyle, ImageToolbar, ImageUpload, Indent, Italic, Link, List, Markdown, MediaEmbed, Mention, Paragraph, PasteFromOffice, SourceEditing, Table, TableToolbar, TodoList } from 'ckeditor5';

export class MyEditor extends ClassicEditor {
  public static builtinPlugins: any[] = [
    Mention,
    Autoformat,
    BlockQuote,
    Bold,
    Heading,
    Image,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    Indent,
    Italic,
    Link,
    List,
    Markdown,
    MediaEmbed,
    Paragraph,
    PasteFromOffice,
    Table,
    TableToolbar,
    TodoList,
    SourceEditing,
  ];

  public static defaultConfig = {
    toolbar: {
      items: [
        'undo', 'redo',
        '|', 'heading',
        '|', 'bold', 'italic',
        '|', 'link', 'uploadImage', 'insertTable', 'mediaEmbed',
        '|', 'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent',
        '|', 'sourceEditing'
      ]
    },
    language: 'de',
    image: {
      toolbar: [
        'imageTextAlternative',
        'toggleImageCaption',
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side'
      ]
    },
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells'
      ]
    }
  };
}

export const Editor = ClassicEditor;

export const config = {
  plugins: [
    Mention,
    Autoformat,
    BlockQuote,
    Bold,
    Heading,
    Image,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    Indent,
    Italic,
    Link,
    List,
    Markdown,
    MediaEmbed,
    Paragraph,
    PasteFromOffice,
    Table,
    TableToolbar,
    TodoList,
    SourceEditing,
  ],
  toolbar: {
    items: [
      'undo', 'redo',
      '|', 'heading',
      '|', 'bold', 'italic',
      '|', 'link', 'uploadImage', 'insertTable', 'mediaEmbed',
      '|', 'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent',
      '|', 'sourceEditing'
    ]
  },
  language: 'de',
  image: {
    toolbar: [
      'imageTextAlternative',
      'toggleImageCaption',
      'imageStyle:inline',
      'imageStyle:block',
      'imageStyle:side'
    ]
  },
  table: {
    contentToolbar: [
      'tableColumn',
      'tableRow',
      'mergeTableCells'
    ]
  }
}
