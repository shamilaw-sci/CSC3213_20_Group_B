import { Checkbox } from '@scs/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@scs/ui/components/dialog';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@scs/ui/components/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { Separator } from '@scs/ui/components/separator';
import { Switch } from '@scs/ui/components/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@scs/ui/components/tabs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Base UI migration contracts', () => {
  test('keeps visual separators decorative by default', () => {
    render(<Separator data-testid="separator" />);

    expect(screen.getByTestId('separator')).toHaveAttribute('role', 'none');
    expect(screen.getByTestId('separator')).not.toHaveAttribute(
      'aria-orientation'
    );
  });

  test('allows an explicit semantic separator', () => {
    render(<Separator data-testid="separator" decorative={false} />);

    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
  });

  test('positions a popover against its explicit anchor', async () => {
    const rect = (x: number, y: number, width: number, height: number) => ({
      bottom: y + height,
      height,
      left: x,
      right: x + width,
      top: y,
      width,
      x,
      y,
      toJSON: () => ({}),
    });
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.testid === 'anchor') return rect(320, 40, 80, 24);
        if (this.dataset.testid === 'trigger') return rect(20, 40, 80, 24);
        if (this.dataset.slot === 'popover-content') {
          return rect(0, 0, 120, 60);
        }
        return rect(0, 0, 0, 0);
      });

    render(
      <Popover defaultOpen>
        <PopoverAnchor data-testid="anchor" />
        <PopoverTrigger data-testid="trigger">Open</PopoverTrigger>
        <PopoverContent data-testid="content">Content</PopoverContent>
      </Popover>
    );

    await waitFor(() => {
      const positioner = screen.getByTestId('content').parentElement;
      expect(positioner?.style.transform).toContain('320px');
    });

    getBoundingClientRect.mockRestore();
  });

  test('restores focus after dismissing a dialog with Escape', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Migration check</DialogTitle>
          <button type="button">Inside action</button>
        </DialogContent>
      </Dialog>
    );

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  test('serializes checkbox and switch values through hidden form inputs', async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="settings-form">
        <Checkbox name="consent" value="yes" defaultChecked />
        <Switch name="updates" value="enabled" uncheckedValue="disabled" />
      </form>
    );

    const form = screen.getByTestId('settings-form') as HTMLFormElement;
    expect(Object.fromEntries(new FormData(form))).toEqual({
      consent: 'yes',
      updates: 'disabled',
    });

    await user.click(screen.getByRole('switch'));
    expect(Object.fromEntries(new FormData(form))).toEqual({
      consent: 'yes',
      updates: 'enabled',
    });
  });

  test('resolves Select labels and leaves disabled options unavailable', async () => {
    const user = userEvent.setup();
    render(
      <Select
        defaultValue="SEM1"
        items={[
          { value: 'SEM1', label: 'Semester 1' },
          { value: 'SEM2', label: 'Semester 2' },
        ]}
      >
        <SelectTrigger aria-label="Semester">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SEM1">Semester 1</SelectItem>
          <SelectItem value="SEM2" disabled>
            Semester 2
          </SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole('combobox', { name: 'Semester' });
    expect(trigger).toHaveTextContent('Semester 1');

    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'Semester 2' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  test('keeps tabs manual while supporting arrow-key focus movement', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="details">Details panel</TabsContent>
      </Tabs>
    );

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const details = screen.getByRole('tab', { name: 'Details' });
    await user.click(overview);
    await user.keyboard('{ArrowRight}');

    expect(details).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(details).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{Enter}');
    expect(details).toHaveAttribute('aria-selected', 'true');
  });
});
