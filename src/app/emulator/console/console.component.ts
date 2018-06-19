import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {TI994A} from '../classes/ti994a';
import {DiskImage} from '../classes/disk';
import {Settings} from '../../classes/settings';
import {CommandDispatcherService} from '../../services/command-dispatcher.service';
import {Subscription} from 'rxjs/Subscription';
import {Command, CommandType} from '../../classes/command';
import {ModuleService} from '../../services/module.service';
import {Log} from '../../classes/log';

@Component({
  selector: 'app-console',
  templateUrl: './console.component.html',
  styleUrls: ['./console.component.css']
})
export class ConsoleComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() diskImages: {[key: string]: DiskImage};
  @Input() settings: Settings;
  @Output() consoleReady: EventEmitter<TI994A> = new EventEmitter<TI994A>();
  private ti994A: TI994A;
  private canvas: HTMLCanvasElement;
  private subscription: Subscription;
  private log: Log = Log.getLog();

  constructor(
      private element: ElementRef,
      private commandDispatcherService: CommandDispatcherService,
      private softwareService: ModuleService
  ) {}

  ngOnInit() {
      this.subscription = this.commandDispatcherService.subscribe(this.onCommand.bind(this));
  }

  ngAfterViewInit() {
      console.log(this.settings);
      this.canvas = this.element.nativeElement.querySelector('canvas');
      this.ti994A = new TI994A(document, this.canvas, this.diskImages, this.settings, null);
      this.consoleReady.emit(this.ti994A);
      // this.ti994A.start(false);
  }

  onCommand(command: Command) {
      switch (command.type) {
          case CommandType.START:
              this.ti994A.start(false);
              break;
          case CommandType.FAST:
              this.ti994A.start(true);
              break;
          case CommandType.FRAME:
              this.ti994A.frame();
              break;
          case CommandType.STEP:
              this.ti994A.step();
              break;
          case CommandType.STOP:
              this.ti994A.stop();
              break;
          case CommandType.RESET:
              this.ti994A.reset(true);
              break;
          case CommandType.OPEN_MODULE:
              this.softwareService.loadModuleFromFile(command.data).subscribe(
                  (software) => {
                      this.ti994A.loadSoftware(software);
                  } ,
                  (error) => {
                      this.log.error(error);
                  }
              );
      }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
