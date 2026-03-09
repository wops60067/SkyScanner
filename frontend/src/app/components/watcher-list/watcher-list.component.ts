import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Watcher } from '../../services/watcher.service';

@Component({
  selector: 'app-watcher-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './watcher-list.component.html',
  styleUrls: ['./watcher-list.component.css']
})
export class WatcherListComponent {
  @Input() watchers: Watcher[] = [];
  @Output() delete = new EventEmitter<number>();

  onDelete(id?: number) {
    if (id !== undefined) {
      if(confirm('Are you sure you want to stop tracking this flight?')) {
        this.delete.emit(id);
      }
    }
  }
}
