import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WatcherListComponent } from './watcher-list.component';

describe('WatcherListComponent', () => {
  let component: WatcherListComponent;
  let fixture: ComponentFixture<WatcherListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatcherListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WatcherListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
