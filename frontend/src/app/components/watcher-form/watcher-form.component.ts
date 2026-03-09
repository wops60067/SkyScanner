import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatcherService, Watcher } from '../../services/watcher.service';

@Component({
  selector: 'app-watcher-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './watcher-form.component.html',
  styleUrls: ['./watcher-form.component.css']
})
export class WatcherFormComponent {
  @Output() watcherAdded = new EventEmitter<void>();

  watcher: Watcher = {
    fly_from: '',
    fly_to: '',
    date_from: '',
    date_to: '',
    curr: 'TWD',
    targetPrice: 5000,
    emailUser: ''
  };

  isSubmitting = false;

  constructor(private watcherService: WatcherService) {}

  onSubmit() {
    this.isSubmitting = true;
    this.watcherService.addWatcher(this.watcher).subscribe({
      next: (data) => {
        console.log('[API Response] 已獲取即時搜尋結果:', data);
        this.watcherAdded.emit();
        // Reset form
        this.watcher = {
          fly_from: '',
          fly_to: '',
          date_from: '',
          date_to: '',
          curr: 'TWD',
          targetPrice: 5000,
          emailUser: ''
        };
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error adding watcher', err);
        this.isSubmitting = false;
      }
    });
  }
}
